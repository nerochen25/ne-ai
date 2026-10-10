import { SignUp } from "@clerk/nextjs";
export default function SignUpPage() {
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
    <SignUp fallbackRedirectUrl="/dashboard" />
  ) : (
    <p>Sign-up is unavailable until Clerk is configured.</p>
  );
}
