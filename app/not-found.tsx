import Link from "next/link";
export default function NotFound() {
  return (
    <main className="access-page">
      <h1>This page wandered off.</h1>
      <Link className="button" href="/dashboard">
        Back to your workspace
      </Link>
    </main>
  );
}
