"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="large-empty">
      <h1>We couldn’t open this page.</h1>
      <p>Your saved work is still in your library. Try again in a moment.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
