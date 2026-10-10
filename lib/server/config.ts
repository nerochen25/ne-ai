import type { Capabilities, Tool } from "@/lib/types";
import { AppError } from "./errors";
export function dailyLimit() {
  const n = Number(process.env.DAILY_REQUEST_LIMIT || 50);
  return Number.isInteger(n) && n > 0 && n <= 10000 ? n : 50;
}
export function ownerAllowed(
  id: string | null,
  ids = process.env.OWNER_CLERK_IDS || "",
) {
  return (
    !!id &&
    ids
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .includes(id)
  );
}
export function capabilities(): Capabilities {
  const storage = [
    "S3_BUCKET",
    "S3_REGION",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ].every((k) => !!process.env[k]);
  const text = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_TEXT_MODEL);
  // GPT image family uses a consistent size/output contract; other models remain unavailable.
  const image = !!(
    process.env.OPENAI_API_KEY &&
    /^gpt-image-/.test(process.env.OPENAI_IMAGE_MODEL || "") &&
    storage
  );
  const media = (tool: "MUSIC" | "VIDEO") =>
    storage &&
    !!process.env.REPLICATE_API_TOKEN &&
    /^[a-f0-9]{64}$/.test(process.env[`REPLICATE_${tool}_VERSION`] || "") &&
    process.env[`REPLICATE_${tool}_VERIFIED`] === "true";
  const missing: string[] = [];
  if (!process.env.DATABASE_URL)
    missing.push("Connect a MySQL database to save your work.");
  if (!text)
    missing.push(
      "Set OPENAI_API_KEY and OPENAI_TEXT_MODEL to enable chat and code.",
    );
  return {
    chat: text,
    code: text,
    image,
    music: media("MUSIC"),
    video: media("VIDEO"),
    imageSizes: image ? ["1024x1024", "1536x1024", "1024x1536"] : [],
    missing,
    dailyLimit: dailyLimit(),
  };
}
export function assertTool(tool: Tool) {
  if (!capabilities()[tool])
    throw new AppError(
      503,
      "NOT_CONFIGURED",
      "This tool is not configured. Check Settings for setup details.",
    );
}
