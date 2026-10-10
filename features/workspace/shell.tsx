"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import {
  ArrowUpRight,
  AudioLines,
  Check,
  ChevronRight,
  Code2,
  Home,
  ImageIcon,
  Library,
  Menu,
  MessageSquare,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Video,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Capabilities } from "@/lib/types";
import { api } from "./client";
const WorkspaceContext = createContext<{
  ownerId: string;
  capabilities: Capabilities;
} | null>(null);
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("Workspace context missing");
  return value;
}
const routes = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/conversation", label: "Chat", icon: MessageSquare },
  { href: "/code", label: "Code", icon: Code2 },
  { href: "/image", label: "Images", icon: ImageIcon },
  { href: "/library", label: "Library", icon: Library },
];
export function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div className="theme-switch" aria-label="Color theme">
      {[
        { id: "light", icon: Sun },
        { id: "dark", icon: Moon },
        { id: "system", icon: Monitor },
      ].map((t) => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          aria-label={`${t.id} theme`}
          aria-pressed={mounted && theme === t.id}
          title={`${t.id} theme`}
        >
          <t.icon size={15} />
        </button>
      ))}
    </div>
  );
}
function Navigation({ close }: { close?: () => void }) {
  const path = usePathname(),
    { capabilities } = useWorkspace();
  return (
    <>
      <div className="nav-section">WORKSPACE</div>
      <nav aria-label="Main navigation">
        {routes
          .filter((r) => r.href !== "/image" || capabilities.image)
          .map((r) => (
            <Link
              key={r.href}
              href={r.href}
              onClick={close}
              className={`nav-link ${path === r.href ? "active" : ""}`}
              aria-current={path === r.href ? "page" : undefined}
            >
              <r.icon size={18} />
              {r.label}
              {path === r.href && <span className="nav-dot" />}
            </Link>
          ))}
        {(capabilities.music || capabilities.video) && (
          <>
            <div className="nav-section">MORE</div>
            {capabilities.music && (
              <Link className="nav-link" href="/music" onClick={close}>
                <AudioLines size={18} />
                Music
              </Link>
            )}
            {capabilities.video && (
              <Link className="nav-link" href="/video" onClick={close}>
                <Video size={18} />
                Video
              </Link>
            )}
          </>
        )}
      </nav>
    </>
  );
}
function Logo() {
  return (
    <Link href="/dashboard" className="brand">
      <span className="brand-symbol">
        <Sparkles size={20} />
      </span>
      <span>
        NE-AI<span className="brand-period">.</span>
      </span>
    </Link>
  );
}
export function Shell({
  children,
  ownerId,
  capabilities,
}: {
  children: React.ReactNode;
  ownerId: string;
  capabilities: Capabilities;
}) {
  const [mobile, setMobile] = useState(false),
    [search, setSearch] = useState(false),
    [query, setQuery] = useState(""),
    [count, setCount] = useState<number | null>(null);
  const path = usePathname(),
    router = useRouter();
  useEffect(() => {
    const update = () => {
      api<{ count: number }>("/api/usage")
        .then((v) => setCount(v.count))
        .catch(() => setCount(null));
    };
    update();
    window.addEventListener("workspace-updated", update);
    return () => window.removeEventListener("workspace-updated", update);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const title =
    routes.find((r) => r.href === path)?.label ||
    (
      {
        "/settings": "Settings",
        "/music": "Music",
        "/video": "Video",
      } as Record<string, string>
    )[path] ||
    "Workspace";
  return (
    <WorkspaceContext.Provider value={{ ownerId, capabilities }}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="app-shell">
        <aside className="desktop-sidebar">
          <Logo />
          <button className="search-button" onClick={() => setSearch(true)}>
            <Search size={16} />
            <span>Search your work</span>
            <kbd>⌘ K</kbd>
          </button>
          <Navigation />
          <div className="sidebar-bottom">
            <div className="usage-box">
              <div>
                <span className="online-dot" />
                Personal workspace
                <ShieldCheck size={14} />
              </div>
              <p>
                {count === null
                  ? "Usage unavailable"
                  : `${count} of ${capabilities.dailyLimit} requests today`}
              </p>
              <div className="usage-track">
                <span
                  style={{
                    width: `${Math.min(100, ((count || 0) / capabilities.dailyLimit) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <Link
              className={`nav-link ${path === "/settings" ? "active" : ""}`}
              href="/settings"
            >
              <Settings2 size={18} />
              Settings
            </Link>
            <div className="sidebar-footer">
              <span className="small-label">MAKE SPACE FOR IDEAS</span>
              <ThemeSelect />
            </div>
          </div>
        </aside>
        <div className="workspace-main">
          <header className="topbar">
            <div className="breadcrumb">
              <Sheet open={mobile} onOpenChange={setMobile}>
                <SheetTrigger asChild>
                  <button
                    className="icon-button mobile-menu"
                    aria-label="Open navigation"
                  >
                    <Menu size={20} />
                  </button>
                </SheetTrigger>
                <SheetContent side="left" className="mobile-drawer">
                  <SheetTitle className="sr-only">
                    Workspace navigation
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Navigate your workspace and choose a color theme.
                  </SheetDescription>
                  <Logo />
                  <Navigation close={() => setMobile(false)} />
                  <Link
                    href="/settings"
                    onClick={() => setMobile(false)}
                    className="nav-link"
                  >
                    <Settings2 size={18} />
                    Settings
                  </Link>
                  <ThemeSelect />
                </SheetContent>
              </Sheet>
              <span className="breadcrumb-root">Workspace</span>
              <ChevronRight size={14} />
              <span>{title}</span>
            </div>
            <div className="topbar-right">
              <span className="private-label">
                <ShieldCheck size={14} />
                Private workspace
              </span>
              <Link className="button small secondary" href="/conversation">
                <Plus size={15} />
                New chat
              </Link>
              <UserButton />
            </div>
          </header>
          <main id="main-content" className="page-content">
            {children}
          </main>
          <footer className="workspace-footer">
            <span>NE-AI · Your ideas, a little further.</span>
            <span>
              <span className="online-dot" />A space of your own
            </span>
          </footer>
        </div>
      </div>
      <Dialog open={search} onOpenChange={setSearch}>
        <DialogContent>
          <DialogTitle>Find your next thought</DialogTitle>
          <DialogDescription>
            Search saved conversations and creations.
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(false);
              router.push(`/library?q=${encodeURIComponent(query)}`);
            }}
            className="search-form"
          >
            <input
              autoFocus
              aria-label="Search saved work"
              placeholder="Search your work…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="button" type="submit">
              <Search size={16} />
              Search
            </button>
          </form>
          <div className="quick-links">
            {routes
              .slice(1, 4)
              .filter((r) => r.href !== "/image" || capabilities.image)
              .map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  onClick={() => setSearch(false)}
                >
                  <r.icon size={18} />
                  {r.label}
                  <ArrowUpRight size={15} />
                </Link>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </WorkspaceContext.Provider>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 title={title}>{title}</h1>
        <p className="description">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function SetupNotice({
  tool,
}: {
  tool: keyof Pick<Capabilities, "chat" | "code" | "image" | "music" | "video">;
}) {
  const { capabilities } = useWorkspace();
  return capabilities[tool] ? null : (
    <div className="notice">
      <Settings2 size={18} />
      <div>
        <strong>A little setup first</strong>
        <p>
          This tool needs a provider connection.{" "}
          <Link href="/settings">
            View setup details <ArrowUpRight size={12} />
          </Link>
        </p>
      </div>
    </div>
  );
}
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false),
    [failed, setFailed] = useState(false);
  return (
    <button
      className="text-button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          setFailed(true);
        }
      }}
    >
      {copied ? (
        <>
          <Check size={14} />
          Copied
        </>
      ) : failed ? (
        "Copy unavailable"
      ) : (
        "Copy"
      )}
    </button>
  );
}
