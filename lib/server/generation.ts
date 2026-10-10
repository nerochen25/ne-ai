import "server-only";
import { after } from "next/server";
import type { Generation, StreamEvent, Tool } from "@/lib/types";
import { requireOwner, assertSameOrigin } from "./auth";
import { AppError, errorResponse } from "./errors";
import { assertTool } from "./config";
import { generationInput, readJson } from "./validation";
import * as repo from "./repository";
import {
  textStream,
  generateImage,
  startPrediction,
  readPrediction,
  downloadMedia,
  cancelPrediction,
} from "./providers";
import { putObject, removeObject, extension } from "./storage";

export async function handleText(req: Request, tool: "chat" | "code") {
  const requestId = crypto.randomUUID();
  let reserved: Generation | undefined;
  try {
    const owner = await requireOwner();
    assertSameOrigin(req);
    assertTool(tool);
    const input = generationInput.parse(await readJson(req));
    const { generation: g, reused } = await repo.reserve(owner, {
      ...input,
      tool,
    });
    if (reused)
      return Response.json({ generation: g, reused: true }, { status: 200 });
    reserved = g;
    if (!(await repo.claim(g.id)))
      throw new AppError(
        409,
        "BUSY",
        "This request is already being processed.",
      );
    const conversation = await repo.getConversation(owner, g.conversationId!);
    const encoder = new TextEncoder(),
      abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 180000);
    const onAbort = () => abort.abort();
    if (req.signal.aborted) abort.abort();
    req.signal.addEventListener("abort", onAbort, { once: true });
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        let content = "",
          tokens = { inputTokens: 0, outputTokens: 0 },
          lastSave = Date.now(),
          closed = false;
        let monitoring = true;
        let cancellationTimer: ReturnType<typeof setTimeout>;
        // Poll independently of provider events: reasoning and searches can
        // remain silent for a long time. Schedule after each read to avoid overlap.
        const checkCancellation = async () => {
          if (!monitoring || abort.signal.aborted) return;
          try {
            const current = await repo.getGeneration(owner, g.id);
            if (monitoring && current.cancelRequested) abort.abort();
          } catch {
            // A transient database error must not create an unhandled rejection.
            // Retry on the next tick; the request timeout remains in force.
          }
          if (monitoring && !abort.signal.aborted)
            cancellationTimer = setTimeout(checkCancellation, 1000);
        };
        cancellationTimer = setTimeout(checkCancellation, 1000);
        const send = (event: StreamEvent) => {
          if (!closed)
            try {
              controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
            } catch {
              closed = true;
              abort.abort();
            }
        };
        send({
          type: "start",
          generationId: g.id,
          conversationId: g.conversationId!,
        });
        try {
          for await (const event of textStream(
            g,
            conversation.messages,
            abort.signal,
          )) {
            if (event.text) {
              content += event.text;
              send({ type: "delta", text: event.text });
            }
            if (event.replace !== undefined) {
              content = event.replace;
              send({ type: "replace", text: content });
            }
            if (event.searching !== undefined)
              send({
                type: "progress",
                status: event.searching ? "searching" : "thinking",
              });
            if (event.inputTokens !== undefined)
              tokens = {
                inputTokens: event.inputTokens,
                outputTokens: event.outputTokens ?? 0,
              };
            if (Date.now() - lastSave > 1000) {
              await repo.saveAssistant(g, content, "running");
              lastSave = Date.now();
            }
          }
          if ((await repo.getGeneration(owner, g.id)).cancelRequested) {
            abort.abort();
            throw new Error("Cancelled");
          }
          await repo.finish(g.id, "completed", null, tokens, content);
          send({ type: "done", generationId: g.id });
        } catch {
          const status = abort.signal.aborted ? "cancelled" : "failed";
          const message =
            status === "cancelled"
              ? "Generation stopped. Partial work is saved; provider charges may still apply."
              : "The response was interrupted. Your partial work is saved. You can retry.";
          try {
            await repo.finish(g.id, status, message, tokens, content);
            send({ type: "error", message, requestId });
          } catch {
            console.error(
              JSON.stringify({
                event: "checkpoint_failed",
                requestId,
                generationId: g.id,
              }),
            );
            send({
              type: "error",
              message:
                "The connection to saved history failed. Copy the visible response before leaving this page.",
              requestId,
            });
          }
        } finally {
          monitoring = false;
          clearTimeout(cancellationTimer);
          clearTimeout(timeout);
          req.signal.removeEventListener("abort", onAbort);
          if (!closed)
            try {
              controller.close();
            } catch {
              /* Client disconnected. */
            }
        }
      },
      cancel() {
        abort.abort();
      },
    });
    return new Response(body, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
        "X-Request-ID": requestId,
      },
    });
  } catch (error) {
    if (reserved) {
      const message = "Generation could not start. Please try again.";
      // Finalize message and reservation together. A failed transaction leaves
      // the job active for scheduler recovery rather than publishing partial state.
      try {
        await repo.finish(reserved.id, "failed", message);
      } catch {
        console.error(
          JSON.stringify({
            event: "startup_cleanup_failed",
            requestId,
            generationId: reserved.id,
          }),
        );
      }
    }
    return errorResponse(error, requestId);
  }
}
async function persistAsset(
  g: Generation,
  result: { bytes: Uint8Array; mime: string },
) {
  const key = `${g.ownerId}/${g.id}/${crypto.randomUUID()}.${extension(result.mime)}`;
  await putObject(key, result.bytes, result.mime);
  try {
    await repo.addAsset(g, {
      key,
      mime: result.mime,
      size: result.bytes.length,
    });
  } catch (error) {
    await removeObject(key);
    throw error;
  }
}
export async function runMedia(g: Generation) {
  if (!(await repo.claim(g.id))) return;
  try {
    if (g.tool === "image") {
      await persistAsset(g, await generateImage(g));
      await repo.finish(g.id, "completed");
    } else {
      const prediction = await startPrediction(g);
      await repo.setProvider(g.id, prediction.id);
    }
  } catch {
    await repo.finish(
      g.id,
      "failed",
      "Generation could not finish. Check provider configuration or try again.",
    );
  }
}
export async function refreshMedia(g: Generation) {
  if (g.status !== "running" || !g.providerId) return g;
  const p = await readPrediction(g.providerId);
  if (p.status === "succeeded") {
    // Claim ingestion with an atomic state transition to prevent duplicate uploads on concurrent polls.
    if (!(await ingestionClaim(g.id)))
      return repo.getGeneration(g.ownerId, g.id);
    try {
      await persistAsset(g, await downloadMedia(p.output, g.tool));
      await repo.finish(g.id, "completed");
    } catch {
      await repo.finish(
        g.id,
        "failed",
        "The generated file could not be saved. Check storage settings.",
      );
    }
  } else if (["failed", "canceled"].includes(p.status))
    await repo.finish(
      g.id,
      p.status === "canceled" ? "cancelled" : "failed",
      "The provider did not complete this generation.",
    );
  return repo.getGeneration(g.ownerId, g.id);
}
async function ingestionClaim(id: string) {
  // providerId is cleared before ingestion; other pollers cannot claim it twice.
  const { db } = await import("@/lib/prismadb");
  return (
    (
      await db.generation.updateMany({
        where: { id, status: "running", providerId: { not: null } },
        data: { providerId: null },
      })
    ).count === 1
  );
}
export async function handleMedia(req: Request, tool: Tool) {
  try {
    const owner = await requireOwner();
    assertSameOrigin(req);
    assertTool(tool);
    const input = generationInput.parse(await readJson(req));
    if (input.conversationId)
      throw new AppError(
        400,
        "INVALID_INPUT",
        "Media requests cannot use a conversation.",
      );
    const result = await repo.reserve(owner, { ...input, tool });
    if (!result.reused) after(() => runMedia(result.generation));
    return Response.json(result, { status: result.reused ? 200 : 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function dispatchJobs() {
  const outcomes = await Promise.allSettled(
    (await repo.pendingJobs()).map(async (g) => {
      if (Date.now() - Date.parse(g.updatedAt) > 10 * 60 * 1000) {
        // Stop an externally running job before releasing its reservation when possible.
        if (g.providerId) await cancelPrediction(g.providerId);
        await repo.finish(
          g.id,
          "failed",
          "This job timed out. It was not automatically retried to avoid duplicate charges.",
        );
        return;
      }
      if (g.tool === "chat" || g.tool === "code") return;
      if (g.status === "queued") await runMedia(g);
      else await refreshMedia(g);
    }),
  );
  if (outcomes.some((result) => result.status === "rejected"))
    throw new AppError(
      503,
      "JOB_DISPATCH",
      "Some jobs could not be refreshed. The scheduler should retry its next tick.",
    );
}
