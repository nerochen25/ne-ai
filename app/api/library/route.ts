import { requireOwner } from "@/lib/server/auth";
import { library } from "@/lib/server/repository";
import { libraryQuery } from "@/lib/server/validation";
import { errorResponse } from "@/lib/server/errors";
export async function GET(req: Request) {
  try {
    const owner = await requireOwner();
    const query = libraryQuery.parse(
      Object.fromEntries(new URL(req.url).searchParams),
    );
    return Response.json(await library(owner, query), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
