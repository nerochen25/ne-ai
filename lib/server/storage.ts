import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Asset } from "@/lib/types";
function client() {
  return new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
}
export async function putObject(key: string, body: Uint8Array, mime: string) {
  await client().send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: mime,
      ServerSideEncryption:
        process.env.S3_SERVER_SIDE_ENCRYPTION === "AES256"
          ? "AES256"
          : undefined,
    }),
    { abortSignal: AbortSignal.timeout(30000) },
  );
}
export async function removeObject(key: string) {
  await client().send(
    new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
    { abortSignal: AbortSignal.timeout(30000) },
  );
}
export async function assetResponse(asset: Asset, download: boolean) {
  const url = await getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: asset.key,
      ResponseContentDisposition: `${download ? "attachment" : "inline"}; filename="ne-ai-${asset.id}.${extension(asset.mime)}"`,
    }),
    { expiresIn: 60 },
  );
  return new Response(null, {
    status: 307,
    headers: { Location: url, "Cache-Control": "private, no-store" },
  });
}
export function extension(mime: string) {
  return (
    (
      {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
        "audio/wav": "wav",
        "audio/mpeg": "mp3",
        "video/mp4": "mp4",
        "image/svg+xml": "svg",
      } as Record<string, string>
    )[mime] || "bin"
  );
}
