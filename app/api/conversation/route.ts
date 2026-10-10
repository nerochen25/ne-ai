import { handleText } from "@/lib/server/generation";
export const runtime = "nodejs";
export const maxDuration = 60;
export const POST = (req: Request) => handleText(req, "chat");
