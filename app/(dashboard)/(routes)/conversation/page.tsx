import { Suspense } from "react";
import { ChatWorkspace } from "@/features/chat/chat-workspace";
export default function Page() {
  return (
    <Suspense fallback={<p>Opening workspace…</p>}>
      <ChatWorkspace tool="chat" />
    </Suspense>
  );
}
