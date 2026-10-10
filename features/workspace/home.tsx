import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Code2,
  ImageIcon,
  MessageSquare,
  Plus,
  Sparkles,
} from "lucide-react";
import type { Capabilities, LibraryItem } from "@/lib/types";
import { ItemGrid } from "@/features/library/item-grid";
const prompts = [
  {
    title: "Find a fresh perspective",
    text: "Help me think through an idea and find a fresh perspective.",
    tool: "conversation",
    icon: MessageSquare,
  },
  {
    title: "Build something useful",
    text: "Help me design a small, useful TypeScript utility. Start by asking what problem it should solve.",
    tool: "code",
    icon: Code2,
  },
  {
    title: "Imagine a quiet place",
    text: "A quiet architectural retreat in a forest, natural materials, soft morning light, editorial photography.",
    tool: "image",
    icon: ImageIcon,
  },
];
export function Home({
  items,
  error,
  capabilities,
}: {
  items: LibraryItem[];
  error?: string;
  capabilities: Capabilities;
}) {
  return (
    <div className="home-page">
      <div className="home-intro">
        <div>
          <p className="eyebrow">
            <span className="online-dot" /> YOUR PERSONAL WORKSPACE
          </p>
          <h1>
            Make room for
            <br />
            <span>your next idea.</span>
          </h1>
          <p>
            A place to think clearly, write code, and keep your useful work.
            <br className="desktop-break" /> Where would you like to start?
          </p>
          <Link href="/conversation" className="button">
            <Plus size={17} />
            Start a conversation
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="idea-art" aria-hidden="true">
          <div className="art-grid" />
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <span className="art-spark">
            <Sparkles />
          </span>
          <span className="art-code">
            <Code2 />
          </span>
          <span className="art-image">
            {capabilities.image ? <ImageIcon /> : <MessageSquare />}
          </span>
          <div className="art-note">
            <span>ONE SMALL THOUGHT</span>
            <strong>
              Endless
              <br />
              possibilities.
            </strong>
            <ArrowDownLeft size={29} />
          </div>
          <span className="art-caption">A SPACE TO EXPLORE / 001</span>
        </div>
      </div>
      <section className="tool-cards" aria-label="Create something">
        {[
          {
            title: "Think it through",
            label: "CHAT",
            text: "A sounding board for curious minds.",
            href: "/conversation",
            icon: MessageSquare,
            color: "sky",
          },
          {
            title: "Make it work",
            label: "CODE",
            text: "From a tricky problem to a clear solution.",
            href: "/code",
            icon: Code2,
            color: "sand",
          },
          {
            title: "Bring it to life",
            label: "IMAGES",
            text: "Give your imagination a little shape.",
            href: "/image",
            icon: ImageIcon,
            color: "lavender",
          },
        ]
          .filter((t) => t.href !== "/image" || capabilities.image)
          .map((t) => (
            <Link key={t.href} href={t.href} className={`tool-card ${t.color}`}>
              <div className="tool-card-top">
                <span className="tool-icon">
                  <t.icon size={21} />
                </span>
                <ArrowUpRight size={18} />
              </div>
              <span className="small-label">{t.label}</span>
              <h2>{t.title}</h2>
              <p>{t.text}</p>
            </Link>
          ))}
      </section>
      <section className="recent-section">
        <div className="section-heading">
          <div>
            <h2>Pick up where you left off</h2>
            <p>Your thoughts and creations, all in one place.</p>
          </div>
          <Link className="text-link" href="/library">
            View library
            <ArrowRight size={15} />
          </Link>
        </div>
        {error ? (
          <div className="notice">
            <p>
              {error} <Link href="/settings">Check setup</Link>
            </p>
          </div>
        ) : items.length ? (
          <ItemGrid items={items.slice(0, 6)} compact />
        ) : (
          <div className="empty-recent">
            <span className="empty-icon">
              <Sparkles size={22} />
            </span>
            <div>
              <h3>Your next idea belongs here</h3>
              <p>
                Start a conversation or work through some code. We’ll keep it
                ready for you.
              </p>
            </div>
            <Link
              href="/conversation"
              aria-label="Start your first conversation"
            >
              <ArrowUpRight size={22} />
            </Link>
          </div>
        )}
      </section>
      <section className="prompt-section">
        <div className="section-heading">
          <div>
            <h2>A spark to get you started</h2>
            <p>No perfect prompt needed.</p>
          </div>
          <Sparkles size={19} />
        </div>
        <div className="prompt-cards">
          {prompts
            .filter((p) => p.tool !== "image" || capabilities.image)
            .map((p) => (
              <Link
                key={p.title}
                href={`/${p.tool}?prompt=${encodeURIComponent(p.text)}`}
              >
                <p.icon size={18} />
                <span>{p.title}</span>
                <ArrowUpRight size={15} />
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}
