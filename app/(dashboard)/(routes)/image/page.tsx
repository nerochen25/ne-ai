import { Suspense } from "react";
import { ImageWorkspace } from "@/features/images/image-workspace";
export default function Page() {
  return (
    <Suspense fallback={<p>Opening studio…</p>}>
      <ImageWorkspace tool="image" />
    </Suspense>
  );
}
