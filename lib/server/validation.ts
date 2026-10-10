import { z } from "zod";
import { AppError } from "./errors";
export const generationInput = z
  .object({
    prompt: z.string().trim().min(1).max(12000),
    conversationId: z.string().min(1).max(100).optional(),
    idempotencyKey: z.string().uuid(),
    size: z.enum(["1024x1024", "1536x1024", "1024x1536"]).optional(),
  })
  .strict();
export const itemPatch = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    favorite: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export const libraryQuery = z.object({
  q: z.string().max(200).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  tool: z
    .enum(["all", "chat", "code", "image", "music", "video"])
    .default("all"),
  favorite: z.enum(["true", "false"]).default("false"),
});
export async function readJson(req: Request) {
  if (!req.headers.get("content-type")?.includes("application/json"))
    throw new AppError(415, "CONTENT_TYPE", "Send JSON content.");
  const reader = req.body?.getReader();
  if (!reader) throw new AppError(400, "EMPTY", "A request body is required.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 64000) {
      await reader.cancel();
      throw new AppError(413, "TOO_LARGE", "The request is too large.");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
