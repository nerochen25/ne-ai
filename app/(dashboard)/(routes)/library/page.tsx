import { Suspense } from "react";
import { LibraryWorkspace } from "@/features/library/library-workspace";
export default function Page() {
  return (
    <Suspense fallback={<p>Opening library…</p>}>
      <LibraryWorkspace />
    </Suspense>
  );
}
