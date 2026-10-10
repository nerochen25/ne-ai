import { requireOwner } from "@/lib/server/auth";
import { usage } from "@/lib/server/repository";
import { errorResponse } from "@/lib/server/errors";
export async function GET() {
  try {
    return Response.json(await usage(await requireOwner()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
