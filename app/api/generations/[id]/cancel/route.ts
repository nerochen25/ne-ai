import { requireOwner, assertSameOrigin } from "@/lib/server/auth";
import { requestCancellation } from "@/lib/server/repository";
import { errorResponse } from "@/lib/server/errors";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const owner = await requireOwner();
    assertSameOrigin(req);
    await requestCancellation(owner, (await params).id);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
