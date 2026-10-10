import { requireOwner } from "@/lib/server/auth";
import { getAsset } from "@/lib/server/repository";
import { assetResponse } from "@/lib/server/storage";
import { errorResponse } from "@/lib/server/errors";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const a = await getAsset(await requireOwner(), (await params).id);
    return assetResponse(
      a,
      new URL(req.url).searchParams.get("download") === "1",
    );
  } catch (e) {
    return errorResponse(e);
  }
}
