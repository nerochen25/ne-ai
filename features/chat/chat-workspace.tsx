"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowUp,
  ArrowUpRight,
  Code2,
  Download,
  MessageSquare,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
} from "lucide-react";
import {
  CopyButton,
  PageHeader,
  SetupNotice,
  useWorkspace,
} from "@/features/workspace/shell";
import { api, downloadText } from "@/features/workspace/client";
import type {
  Conversation,
  Generation,
  Message,
  StreamEvent,
} from "@/lib/types";
const Markdown = dynamic(() => import("./markdown"), {
  loading: () => <span className="muted">Rendering response…</span>,
});
export function ChatWorkspace({ tool }: { tool: "chat" | "code" }) {
  const { ownerId, capabilities } = useWorkspace(),
    params = useSearchParams();
  const initialId = params.get("id"),
    preset = params.get("prompt");
  const [id, setId] = useState<string | null>(initialId),
    [messages, setMessages] = useState<Message[]>([]),
    [prompt, setPrompt] = useState(""),
    [busy, setBusy] = useState(false),
    [activeGeneration, setActiveGeneration] =
      useState<Conversation["activeGeneration"]>(null),
    [searching, setSearching] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [title, setTitle] = useState("");
  const epoch = useRef(0);
  const followResponse = useRef(true);
  const generationId = useRef<string | null>(null),
    localConversation = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null),
    bottom = useRef<HTMLDivElement>(null),
    composer = useRef<HTMLTextAreaElement>(null),
    requestKey = useRef<{
      prompt: string;
      conversationId: string | null;
      key: string;
    } | null>(null),
    draftReady = useRef(false);
  const draftKey = `ne-ai:draft:${ownerId}:${tool}:${id || "new"}`;
  useEffect(() => {
    if (initialId && initialId === localConversation.current) return;
    localConversation.current = null;
    followResponse.current = true;
    epoch.current += 1;
    abort.current?.abort();
    setBusy(false);
    setActiveGeneration(null);
    requestKey.current = null;
    draftReady.current = false;
    setId(initialId);
    setMessages([]);
    setTitle("");
    setError("");
    setLoading(false);
    if (!initialId) return;
    let live = true;
    setLoading(true);
    api<Conversation>(`/api/conversations/${initialId}`)
      .then((c) => {
        if (live) {
          if (c.tool !== tool) {
            setError(
              "This conversation belongs to another tool. Open it from the Library.",
            );
            return;
          }
          setMessages(c.messages);
          setTitle(c.title);
          setActiveGeneration(c.activeGeneration);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [initialId, tool]);
  const activeGenerationId = activeGeneration?.id;
  useEffect(() => {
    if (!id || !activeGenerationId || busy) return;
    const client = new AbortController();
    const turn = epoch.current;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const c = await api<Conversation>(`/api/conversations/${id}`, {
          signal: client.signal,
        });
        if (!live || turn !== epoch.current) return;
        setMessages((previous) =>
          previous.length === c.messages.length &&
          previous.every((message, index) => {
            const next = c.messages[index];
            return (
              message.id === next.id &&
              message.role === next.role &&
              message.content === next.content &&
              message.status === next.status &&
              message.createdAt === next.createdAt
            );
          })
            ? previous
            : c.messages,
        );
        setTitle(c.title);
        setError("");
        setActiveGeneration(c.activeGeneration);
        if (!c.activeGeneration) {
          window.dispatchEvent(new Event("workspace-updated"));
          return;
        }
      } catch {
        if (!live || turn !== epoch.current) return;
        setError(
          "Unable to refresh this response. Reconnecting to saved history…",
        );
      }
      timer = setTimeout(refresh, 1500);
    }
    timer = setTimeout(refresh, 1500);
    return () => {
      live = false;
      clearTimeout(timer);
      client.abort();
    };
  }, [id, activeGenerationId, busy]);
  useEffect(() => {
    try {
      setPrompt(preset || localStorage.getItem(draftKey) || "");
    } catch {
      setPrompt(preset || "");
    }
    draftReady.current = true;
  }, [draftKey, preset]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    const trackPosition = () => {
      const marker = bottom.current?.getBoundingClientRect();
      if (marker)
        followResponse.current =
          marker.top >= 0 && marker.top <= window.innerHeight + 120;
    };
    window.addEventListener("scroll", trackPosition, { passive: true });
    return () => window.removeEventListener("scroll", trackPosition);
  }, []);
  useEffect(() => {
    if (!followResponse.current) return;
    bottom.current?.scrollIntoView({
      behavior: "instant",
      block: "end",
    });
  }, [messages]);
  function draft(value: string) {
    setPrompt(value);
    if (draftReady.current)
      try {
        localStorage.setItem(draftKey, value);
      } catch {
        /* Storage may be disabled; server history still works. */
      }
  }
  async function send(text = prompt) {
    if (
      !text.trim() ||
      busy ||
      activeGeneration ||
      loading ||
      !capabilities[tool]
    )
      return;
    const turn = ++epoch.current;
    followResponse.current = true;
    setError("");
    setBusy(true);
    setSearching(false);
    const previous = id;
    generationId.current = null;
    if (
      !requestKey.current ||
      requestKey.current.prompt !== text ||
      requestKey.current.conversationId !== previous
    )
      requestKey.current = {
        prompt: text,
        conversationId: previous,
        key: crypto.randomUUID(),
      };
    const client = new AbortController();
    abort.current = client;
    const user: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
      status: "completed",
    };
    const assistant: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      status: "running",
    };
    let savedId: string | null,
      accepted = false;
    try {
      const response = await fetch(
        tool === "chat" ? "/api/conversation" : "/api/code",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: text,
            conversationId: previous || undefined,
            idempotencyKey: requestKey.current.key,
          }),
          signal: client.signal,
        },
      );
      if (turn !== epoch.current) return;
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error?.message || "Unable to start generation.");
      }
      if (response.headers.get("content-type")?.includes("application/json")) {
        const data = (await response.json()) as { generation: Generation };
        savedId = data.generation.conversationId;
        if (savedId) {
          localConversation.current = savedId;
          setId(savedId);
          window.history.replaceState(
            null,
            "",
            `${tool === "chat" ? "/conversation" : "/code"}?id=${savedId}`,
          );
          const c = await api<Conversation>(`/api/conversations/${savedId}`);
          if (turn !== epoch.current) return;
          setMessages(c.messages);
          setTitle(c.title);
          setActiveGeneration(c.activeGeneration);
        }
        setError(
          "This request was already submitted. Its saved result is shown; active work can be reopened from the Library.",
        );
        requestKey.current = null;
        return;
      }
      const reader = response.body?.getReader();
      if (!reader)
        throw new Error("Streaming is unavailable. Please try again.");
      setMessages((v) => [...v, user, assistant]);
      const decoder = new TextDecoder();
      let buffer = "",
        doneEvent = false;
      while (true) {
        const { done, value } = await reader.read();
        if (turn !== epoch.current) {
          await reader.cancel();
          return;
        }
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === "start") {
            generationId.current = event.generationId;
            localConversation.current = event.conversationId;
            accepted = true;
            savedId = event.conversationId;
            setId(savedId);
            setTitle(title || text.slice(0, 100));
            window.history.replaceState(
              null,
              "",
              `${tool === "chat" ? "/conversation" : "/code"}?id=${savedId}`,
            );
            try {
              localStorage.removeItem(draftKey);
            } catch {
              /* Browser storage is optional. */
            }
            setPrompt("");
            requestKey.current = null;
          }
          if (event.type === "delta")
            setMessages((v) =>
              v.map((m) =>
                m.id === assistant.id
                  ? { ...m, content: m.content + event.text }
                  : m,
              ),
            );
          if (event.type === "progress")
            setSearching(event.status === "searching");
          if (event.type === "replace")
            setMessages((v) =>
              v.map((m) =>
                m.id === assistant.id ? { ...m, content: event.text } : m,
              ),
            );
          if (event.type === "error") {
            setError(event.message);
            doneEvent = true;
            setMessages((v) =>
              v.map((m) =>
                m.id === assistant.id ? { ...m, status: "failed" } : m,
              ),
            );
          }
          if (event.type === "done") {
            doneEvent = true;
            setMessages((v) =>
              v.map((m) =>
                m.id === assistant.id ? { ...m, status: "completed" } : m,
              ),
            );
          }
        }
      }
      if (!doneEvent)
        throw new Error(
          "The connection ended early. Reopen the saved conversation to recover partial work.",
        );
    } catch (e) {
      if (turn !== epoch.current) return;
      const stopped = client.signal.aborted;
      setError(
        stopped
          ? "Stopped. Partial work is saved. Provider charges may still apply."
          : e instanceof Error
            ? e.message
            : "Unable to complete this request.",
      );
      setMessages((v) =>
        v.map((m) =>
          m.id === assistant.id
            ? { ...m, status: stopped ? "cancelled" : "failed" }
            : m,
        ),
      );
      if (!accepted) draft(text);
    } finally {
      if (turn === epoch.current) {
        setBusy(false);
        setSearching(false);
        abort.current = null;
        // Keep focus where the reader moved it; only return composer controls
        // to the textarea, without scrolling the conversation.
        if (composer.current?.form?.contains(document.activeElement))
          composer.current.focus({ preventScroll: true });
      }
      window.dispatchEvent(new Event("workspace-updated"));
    }
  }
  const suggestions =
    tool === "chat"
      ? [
          "Help me organize my thoughts",
          "Explain something simply",
          "Find a fresh perspective",
        ]
      : [
          "Review a function for edge cases",
          "Explain a TypeScript concept",
          "Plan a small web application",
        ];
  return (
    <div className="chat-page">
      <PageHeader
        eyebrow={tool === "chat" ? "A LITTLE CLARITY" : "IDEAS INTO ACTION"}
        title={
          title ||
          (tool === "chat" ? "Think out loud." : "Let’s build something.")
        }
        description={
          tool === "chat"
            ? "A place to ask, explore, and untangle your thoughts."
            : "A focused space for code, explanations, and better solutions."
        }
        action={
          <div className="header-actions">
            {messages.length > 0 && (
              <button
                className="button secondary small"
                onClick={() =>
                  downloadText(
                    `${title || "conversation"}.md`,
                    messages
                      .map((m) => `## ${m.role}\n\n${m.content}`)
                      .join("\n\n"),
                  )
                }
              >
                <Download size={15} />
                Export
              </button>
            )}
            <Link
              className="button secondary small"
              href={tool === "chat" ? "/conversation" : "/code"}
              onClick={() => {
                epoch.current += 1;
                abort.current?.abort();
                setBusy(false);
                setActiveGeneration(null);
                requestKey.current = null;
                localConversation.current = null;
                setMessages([]);
                setId(null);
                setTitle("");
                setError("");
              }}
            >
              <Plus size={15} />
              New
            </Link>
          </div>
        }
      />
      <SetupNotice tool={tool} />
      <div className="chat-thread" aria-busy={loading}>
        {loading ? (
          <div className="loading-state">Opening your conversation…</div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <span className="empty-orbit">
              {tool === "chat" ? (
                <MessageSquare size={30} />
              ) : (
                <Code2 size={30} />
              )}
            </span>
            <h2>
              {tool === "chat"
                ? "What’s on your mind?"
                : "What are we working on?"}
            </h2>
            <p>Start with a question. See where it takes you.</p>
            <div className="chat-suggestions">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    draft(s);
                    composer.current?.focus();
                  }}
                >
                  <Sparkles size={15} />
                  {s}
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, index) => (
            <article key={m.id} className={`message ${m.role}`}>
              <div className="message-avatar">
                {m.role === "user" ? "Y" : <Sparkles size={16} />}
              </div>
              <div className="message-body">
                <div className="message-label">
                  {m.role === "user" ? "You" : "NE-AI"}
                  {m.status !== "completed" && (
                    <span>
                      {m.status === "running"
                        ? searching
                          ? "Searching the web…"
                          : "Thinking…"
                        : m.status}
                    </span>
                  )}
                </div>
                {m.role === "assistant" ? (
                  <Markdown text={m.content || "Thinking…"} />
                ) : (
                  <p className="user-message">{m.content}</p>
                )}
                {m.role === "assistant" && m.content && (
                  <CopyButton text={m.content} />
                )}
                {m.role === "assistant" &&
                  !busy &&
                  !activeGeneration &&
                  (m.status === "failed" || m.status === "cancelled") && (
                    <button
                      className="text-button"
                      onClick={() => {
                        const previous = messages
                          .slice(0, index)
                          .reverse()
                          .find((message) => message.role === "user");
                        if (previous) draft(previous.content);
                        composer.current?.focus();
                      }}
                    >
                      <RotateCcw size={14} />
                      Retry prompt
                    </button>
                  )}
              </div>
            </article>
          ))
        )}
        <div ref={bottom} />
      </div>
      <div className="composer-area">
        <span className="sr-only" role="status">
          {busy || activeGeneration
            ? searching
              ? "Searching the web"
              : "Generating response"
            : ""}
        </span>
        {error && (
          <div role="alert" className="inline-error">
            <span>{error}</span>
            {!busy && (
              <button
                className="text-button"
                onClick={() => {
                  const last = [...messages]
                    .reverse()
                    .find((m) => m.role === "user");
                  if (last) draft(last.content);
                  composer.current?.focus();
                }}
              >
                <RotateCcw size={14} />
                Retry prompt
              </button>
            )}
          </div>
        )}
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor="prompt">
            Your message
          </label>
          <textarea
            ref={composer}
            id="prompt"
            value={prompt}
            onChange={(e) => draft(e.target.value)}
            placeholder={
              tool === "chat"
                ? "Ask anything, or start with an idea…"
                : "Describe what you want to build or understand…"
            }
            maxLength={12000}
            disabled={loading || !capabilities[tool]}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                if (!busy) void send();
              }
            }}
          />
          <div className="composer-toolbar">
            <span>
              <Sparkles size={14} />
              {tool === "chat"
                ? "Your thinking partner"
                : "Your coding partner"}
            </span>
            {busy || activeGeneration ? (
              <button
                type="button"
                className="send-button stop"
                aria-label="Stop generation"
                onClick={() => {
                  const runningId =
                    activeGeneration?.id || generationId.current;
                  if (runningId)
                    void api(`/api/generations/${runningId}/cancel`, {
                      method: "POST",
                    }).catch(() =>
                      setError("Unable to stop generation. Please try again."),
                    );
                  abort.current?.abort();
                }}
              >
                <Square size={16} />
              </button>
            ) : (
              <button
                className="send-button"
                aria-label="Send message"
                disabled={!prompt.trim() || loading || !capabilities[tool]}
              >
                <ArrowUp size={20} />
              </button>
            )}
          </div>
        </form>
        <div className="composer-note">
          <span>Enter to send · Shift + Enter for a new line</span>
          <span>AI can make mistakes. Review what matters.</span>
        </div>
      </div>
    </div>
  );
}
