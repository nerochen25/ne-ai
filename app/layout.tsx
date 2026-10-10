import "./globals.css";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Providers } from "@/features/workspace/providers";
export const metadata: Metadata = {
  title: {
    default: "NE-AI · A little space for big ideas",
    template: "%s · NE-AI",
  },
  description:
    "Your private workspace for thinking, writing code, and creating images.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const content = (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
    <ClerkProvider>{content}</ClerkProvider>
  ) : (
    content
  );
}
