import "server-only";
import { auth } from "@clerk/nextjs/server";
import { cache } from "react";
import { AppError } from "./errors";
import { ownerAllowed } from "./config";
export const requireOwner = cache(async () => {
  if (
    !process.env.CLERK_SECRET_KEY ||
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  )
    throw new AppError(
      503,
      "AUTH_SETUP",
      "Configure Clerk and OWNER_CLERK_IDS to open your private workspace.",
    );
  const { userId } = await auth();
  if (!userId) throw new AppError(401, "UNAUTHORIZED", "Sign in to continue.");
  if (!ownerAllowed(userId))
    throw new AppError(
      403,
      "FORBIDDEN",
      "This workspace is private. Your account is not on its owner list.",
    );
  return userId;
});
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const expected = process.env.APP_URL || new URL(req.url).origin;
  if (origin && origin !== new URL(expected).origin)
    throw new AppError(403, "ORIGIN", "This request is not allowed.");
}
