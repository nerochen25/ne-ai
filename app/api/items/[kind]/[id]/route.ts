import { requireOwner, assertSameOrigin } from "@/lib/server/auth";
import * as repo from "@/lib/server/repository";
import { itemPatch, readJson } from "@/lib/server/validation";
import { AppError, errorResponse } from "@/lib/server/errors";
import { removeObject } from "@/lib/server/storage";
type Context = { params: Promise<{ id: string; kind: string }> };
async function context(req: Request, ctx: Context) {
  const owner = await requireOwner();
  assertSameOrigin(req);
  const p = await ctx.params;
  if (!["conversation", "generation"].includes(p.kind))
    throw new AppError(404, "NOT_FOUND", "Item not found.");
  return { owner, ...p };
}
export async function PATCH(req: Request, ctx: Context) {
  try {
    const { owner, id, kind } = await context(req, ctx);
    await repo.patchItem(owner, id, kind, itemPatch.parse(await readJson(req)));
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(req: Request, ctx: Context) {
  try {
    const { owner, id, kind } = await context(req, ctx);
    if (kind === "generation") {
      const g = await repo.getGeneration(owner, id);
      if (["queued", "running"].includes(g.status))
        throw new AppError(
          409,
          "BUSY",
          "Wait for generation to finish before deleting.",
        );
      for (const a of g.assets) await removeObject(a.key);
    }
    await repo.deleteItem(owner, id, kind);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function GET(req: Request, ctx: Context) {
  try {
    const { owner, id, kind } = await context(req, ctx);
    const item =
      kind === "conversation"
        ? await repo.getConversation(owner, id)
        : await repo.getGeneration(owner, id);
    return new Response(JSON.stringify(item, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="ne-ai-${id}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
