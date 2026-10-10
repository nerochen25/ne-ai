"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useRef } from "react";
import { CopyButton } from "@/features/workspace/shell";
function Code({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null),
    text = String(children ?? "").replace(/\n$/, "");
  const language = /language-(\w+)/.exec(className || "")?.[1];
  useEffect(() => {
    if (!language || !ref.current) return;
    let live = true;
    import("highlight.js/lib/common").then(({ default: hljs }) => {
      if (live && ref.current && hljs.getLanguage(language)) {
        ref.current.textContent = text;
        delete ref.current.dataset.highlighted;
        hljs.highlightElement(ref.current);
      }
    });
    return () => {
      live = false;
    };
  }, [language, text]);
  return language ? (
    <span className="code-block">
      <span className="code-toolbar">
        <span>{language}</span>
        <CopyButton text={text} />
      </span>
      <code ref={ref} className={className}>
        {text.replace(/cite[^]*/g, "")}
      </code>
    </span>
  ) : (
    <code className={className}>{children}</code>
  );
}
export default function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: Code,
          img: ({ alt }) => (
            <span className="muted">[Image: {alt || "external image"}]</span>
          ),
          a: ({ children, ...props }) =>
            props.href ? (
              <a {...props} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
