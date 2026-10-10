import { requireOwner } from "@/lib/server/auth";
import { getConversation } from "@/lib/server/repository";
import { errorResponse } from "@/lib/server/errors";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return Response.json(
      await getConversation(await requireOwner(), (await params).id),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
