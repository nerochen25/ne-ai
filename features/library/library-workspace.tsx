"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Library, Search, Star } from "lucide-react";
import type { LibraryItem, Page } from "@/lib/types";
import { api } from "@/features/workspace/client";
import { PageHeader } from "@/features/workspace/shell";
import { ItemGrid } from "./item-grid";
export function LibraryWorkspace() {
  const params = useSearchParams();
  const searchQuery = params.get("q") || "";
  const [q, setQ] = useState(params.get("q") || ""),
    [query, setQuery] = useState(q),
    [tool, setTool] = useState("all"),
    [favorite, setFavorite] = useState(false),
    [page, setPage] = useState(1),
    [data, setData] = useState<Page<LibraryItem> | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [version, setVersion] = useState(0);
  useEffect(() => {
    setQ(searchQuery);
    setQuery(searchQuery);
    setPage(1);
  }, [searchQuery]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(q);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    api<Page<LibraryItem>>(
      `/api/library?${new URLSearchParams({ q: query, tool, favorite: String(favorite), page: String(page) })}`,
    )
      .then((v) => {
        if (live) setData(v);
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
  }, [query, tool, favorite, page, version]);
  return (
    <>
      <PageHeader
        eyebrow="A PLACE FOR EVERYTHING"
        title="Your library."
        description="The good ideas, useful answers, and things you’ve made."
      />
      <div className="library-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search library"
            placeholder="Find something you saved…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter by tool"
          value={tool}
          onChange={(e) => {
            setTool(e.target.value);
            setPage(1);
          }}
        >
          {["all", "chat", "code", "image", "music", "video"].map((t) => (
            <option key={t} value={t}>
              {t === "all" ? "All work" : t[0].toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
        <button
          className={`button secondary ${favorite ? "selected" : ""}`}
          aria-pressed={favorite}
          onClick={() => {
            setFavorite((v) => !v);
            setPage(1);
          }}
        >
          <Star size={16} />
          Favorites
        </button>
      </div>
      <div aria-live="polite" className="results-label">
        {loading ? "Finding your work…" : `${data?.total || 0} saved items`}
      </div>
      {error ? (
        <p role="alert" className="inline-error">
          {error}
        </p>
      ) : data?.items.length ? (
        <ItemGrid
          items={data.items}
          onChange={() => setVersion((v) => v + 1)}
        />
      ) : !loading ? (
        <div className="large-empty">
          <Library size={34} />
          <h2>
            {query || favorite
              ? "Nothing here just yet"
              : "Make something worth keeping"}
          </h2>
          <p>
            {query || favorite
              ? "Try another search or change your filters."
              : "Your conversations and creations appear here automatically."}
          </p>
        </div>
      ) : null}
      <div className="pagination">
        <button
          className="button secondary small"
          disabled={page === 1 || loading}
          onClick={() => setPage((p) => p - 1)}
        >
          <ArrowLeft size={15} />
          Previous
        </button>
        <span>Page {page}</span>
        <button
          className="button secondary small"
          disabled={!data?.hasMore || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
          <ArrowRight size={15} />
        </button>
      </div>
    </>
  );
}
