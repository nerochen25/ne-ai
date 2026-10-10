import { timingSafeEqual } from "node:crypto";
import { dispatchJobs } from "@/lib/server/generation";
import { errorResponse } from "@/lib/server/errors";
export const maxDuration = 300;
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(req.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    !secret ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return new Response("Unauthorized", { status: 401 });
  try {
    await dispatchJobs();
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
