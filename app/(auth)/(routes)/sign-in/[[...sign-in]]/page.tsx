import { SignIn } from "@clerk/nextjs";
export default function SignInPage() {
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
    <SignIn fallbackRedirectUrl="/dashboard" />
  ) : (
    <div className="access-card">
      <h1>Connect your private sign-in</h1>
      <p>
        Configure Clerk environment variables and your owner ID using the
        README, then restart the app.
      </p>
    </div>
  );
}
