import { requireOwner, assertSameOrigin } from "@/lib/server/auth";
import { getGeneration } from "@/lib/server/repository";
import { refreshMedia, runMedia } from "@/lib/server/generation";
import { errorResponse } from "@/lib/server/errors";
import { after } from "next/server";
export const maxDuration = 300;
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return Response.json(
      await getGeneration(await requireOwner(), (await params).id),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const owner = await requireOwner();
    assertSameOrigin(req);
    const g = await getGeneration(owner, (await params).id);
    if (g.tool === "chat" || g.tool === "code") return Response.json(g);
    if (g.status === "queued") after(() => runMedia(g));
    else if (g.status === "running" && g.providerId)
      after(() => refreshMedia(g));
    return Response.json(g);
  } catch (e) {
    return errorResponse(e);
  }
}
