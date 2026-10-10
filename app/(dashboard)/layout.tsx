import Link from "next/link";
import { requireOwner } from "@/lib/server/auth";
import { capabilities } from "@/lib/server/config";
import { AppError } from "@/lib/server/errors";
import { Shell } from "@/features/workspace/shell";
export const dynamic = "force-dynamic";
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let owner: string;
  try {
    owner = await requireOwner();
  } catch (error) {
    const e = error instanceof AppError ? error : null;
    return (
      <main className="access-page">
        <div className="access-card">
          <span className="eyebrow">NE-AI / PRIVATE WORKSPACE</span>
          <h1>
            {e?.status === 401 ? "Welcome back." : "Your space starts here."}
          </h1>
          <p>{e?.message || "The workspace is temporarily unavailable."}</p>
          <Link className="button" href={e?.status === 401 ? "/sign-in" : "/"}>
            {e?.status === 401 ? "Sign in" : "Back to welcome"}
          </Link>
          <p className="muted text-sm">
            Setup instructions are in the repository README.
          </p>
        </div>
      </main>
    );
  }
  return (
    <Shell ownerId={owner} capabilities={capabilities()}>
      {children}
    </Shell>
  );
}
