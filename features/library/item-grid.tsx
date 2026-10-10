"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  Code2,
  Download,
  ImageIcon,
  MessageSquare,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LibraryItem } from "@/lib/types";
import { api } from "@/features/workspace/client";
const iconFor = (tool: string) =>
  tool === "chat" ? MessageSquare : tool === "code" ? Code2 : ImageIcon;
function itemHref(item: LibraryItem) {
  return `/${item.tool === "chat" ? "conversation" : item.tool}?id=${item.id}`;
}
export function ItemGrid({
  items,
  compact = false,
  onChange,
}: {
  items: LibraryItem[];
  compact?: boolean;
  onChange?: () => void;
}) {
  const [editing, setEditing] = useState<LibraryItem | null>(null),
    [deleting, setDeleting] = useState<LibraryItem | null>(null),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function mutate(item: LibraryItem, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/items/${item.kind}/${item.id}`, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
      setEditing(null);
      setDeleting(null);
      onChange?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      <div className={compact ? "recent-grid" : "library-grid"}>
        {items.map((item) => {
          const Icon = iconFor(item.tool),
            asset = item.assets?.[0];
          return (
            <article
              className={`saved-item ${asset ? "has-preview" : ""}`}
              key={item.id}
            >
              {asset && !compact && (
                <Link href={itemHref(item)} className="saved-preview">
                  {asset.mime.startsWith("image/") ? (
                    <img
                      src={`/api/assets/${asset.id}`}
                      alt={item.title}
                      loading="lazy"
                      width={400}
                      height={300}
                    />
                  ) : (
                    <span>
                      <Icon size={32} />
                      {item.tool}
                    </span>
                  )}
                </Link>
              )}
              <Link href={itemHref(item)} className="saved-item-main">
                <span className={`saved-icon ${item.tool}`}>
                  <Icon size={18} />
                </span>
                <div>
                  <h3>{item.title}</h3>
                  <p>
                    {item.tool} <span>·</span>{" "}
                    {new Date(item.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                    {item.status && item.status !== "completed"
                      ? ` · ${item.status}`
                      : ""}
                  </p>
                </div>
                {compact && <ArrowUpRight size={16} />}
              </Link>
              {!compact && (
                <div className="item-actions">
                  <button
                    className={`icon-button ${item.favorite ? "is-favorite" : ""}`}
                    aria-label={`${item.favorite ? "Unfavorite" : "Favorite"} ${item.title}`}
                    disabled={busy}
                    onClick={() =>
                      mutate(item, "PATCH", { favorite: !item.favorite })
                    }
                  >
                    <Star
                      size={15}
                      fill={item.favorite ? "currentColor" : "none"}
                    />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Rename ${item.title}`}
                    onClick={() => {
                      setEditing(item);
                      setName(item.title);
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                  <a
                    className="icon-button"
                    href={`/api/items/${item.kind}/${item.id}`}
                    aria-label={`Export ${item.title}`}
                  >
                    <Download size={15} />
                  </a>
                  <button
                    className="icon-button delete-action"
                    aria-label={`Delete ${item.title}`}
                    onClick={() => setDeleting(item)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <Dialog
        open={!!editing}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Give it a name</DialogTitle>
          <DialogDescription>
            A useful title makes your work easier to find.
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editing) void mutate(editing, "PATCH", { title: name });
            }}
          >
            <label htmlFor="item-name">Title</label>
            <input
              id="item-name"
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={160}
              required
            />
            <button disabled={busy || !name.trim()} className="button">
              Save name
            </button>
            {error && <p role="alert">{error}</p>}
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={(v) => {
          if (!v) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Delete this item?</DialogTitle>
          <DialogDescription>
            “{deleting?.title}” and its saved content will be permanently
            deleted.
          </DialogDescription>
          <div className="header-actions">
            <button
              className="button secondary"
              onClick={() => setDeleting(null)}
            >
              Keep it
            </button>
            <button
              disabled={busy}
              className="button danger"
              onClick={() => deleting && mutate(deleting, "DELETE")}
            >
              Delete item
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
