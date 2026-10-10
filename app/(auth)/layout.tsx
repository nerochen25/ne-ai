import Link from "next/link";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="access-page">
      <Link className="brand" href="/">
        NE-AI.
      </Link>
      {children}
    </main>
  );
}
