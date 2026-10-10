import { handleMedia } from "@/lib/server/generation";
export const runtime = "nodejs";
export const maxDuration = 300;
export const POST = (req: Request) => handleMedia(req, "music");
