"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  Download,
  ImageIcon,
  Maximize2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { Asset, Generation, LibraryItem, Page } from "@/lib/types";
import { api } from "@/features/workspace/client";
import {
  PageHeader,
  SetupNotice,
  useWorkspace,
} from "@/features/workspace/shell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
export function ImageWorkspace({
  tool = "image",
}: {
  tool?: "image" | "music" | "video";
}) {
  const { ownerId, capabilities } = useWorkspace(),
    params = useSearchParams();
  const [prompt, setPrompt] = useState(""),
    [size, setSize] = useState("1024x1024"),
    [current, setCurrent] = useState<Generation | null>(null),
    [history, setHistory] = useState<LibraryItem[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [preview, setPreview] = useState<{ asset: Asset; prompt: string } | null>(
      null,
    );
  const request = useRef<{ key: string; prompt: string; size: string } | null>(
    null,
  );
  const draftKey = `ne-ai:draft:${ownerId}:${tool}`;
  const id = params.get("id");
  const loadHistory = useCallback(() => {
    api<Page<LibraryItem>>(`/api/library?tool=${tool}`)
      .then((d) => setHistory(d.items))
      .catch(() =>
        setError(
          "Saved creations are unavailable. Check your database connection.",
        ),
      );
  }, [tool]);
  useEffect(() => {
    try {
      setPrompt(params.get("prompt") || localStorage.getItem(draftKey) || "");
    } catch {
      /* Browser storage is optional. */
    }
    loadHistory();
  }, [tool, draftKey, params, loadHistory]);
  useEffect(() => {
    if (!id) return;
    let live = true;
    api<Generation>(`/api/generations/${id}`)
      .then((g) => {
        if (live) {
          if (g.tool !== tool) {
            setError("This creation belongs to another tool.");
            return;
          }
          setCurrent(g);
          setPrompt(g.prompt);
          if (g.options.size) setSize(g.options.size);
          if (g.error) setError(g.error);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [id, tool]);
  const currentId = current?.id,
    currentStatus = current?.status;
  useEffect(() => {
    if (
      !currentId ||
      !currentStatus ||
      !["queued", "running"].includes(currentStatus)
    )
      return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    async function poll() {
      try {
        const g = await api<Generation>(`/api/generations/${currentId}`, {
          method: "POST",
        });
        if (!live) return;
        setCurrent(g);
        failures = 0;
        if (!["queued", "running"].includes(g.status)) {
          loadHistory();
          window.dispatchEvent(new Event("workspace-updated"));
          if (g.error) setError(g.error);
          return;
        }
      } catch {
        if (!live) return;
        failures++;
        if (failures >= 5) {
          setError(
            "Connection lost. Your job is saved; reopen it from the Library to check its status.",
          );
          return;
        }
      }
      timer = setTimeout(poll, 1500);
    }
    timer = setTimeout(poll, 500);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [currentId, currentStatus, loadHistory]);
  function draft(value: string) {
    setPrompt(value);
    try {
      localStorage.setItem(draftKey, value);
    } catch {
      /* Browser storage is optional. */
    }
  }
  async function generate() {
    if (!prompt.trim()) return;
    setBusy(true);
    setError("");
    if (
      !request.current ||
      request.current.prompt !== prompt ||
      request.current.size !== size
    )
      request.current = { key: crypto.randomUUID(), prompt, size };
    try {
      const { generation } = await api<{ generation: Generation }>(
        `/api/${tool}`,
        {
          method: "POST",
          body: JSON.stringify({
            prompt,
            idempotencyKey: request.current.key,
            ...(tool === "image" ? { size } : {}),
          }),
        },
      );
      setCurrent(generation);
      window.history.replaceState(null, "", `/${tool}?id=${generation.id}`);
      request.current = null;
      window.dispatchEvent(new Event("workspace-updated"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const running =
    busy || (!!current && ["queued", "running"].includes(current.status));
  const presets =
    tool === "image"
      ? [
          {
            label: "Quiet architecture",
            prompt:
              "A quiet architectural retreat in a forest, natural materials, soft morning light, editorial photography.",
          },
          {
            label: "Everyday still life",
            prompt:
              "An editorial still life of a ceramic cup and a branch on a linen table, muted earth tones, natural window light.",
          },
          {
            label: "Something abstract",
            prompt:
              "An abstract composition of geometric paper forms, sage green and warm ivory, subtle shadows, tactile paper texture.",
          },
        ]
      : [
          {
            label: "A starting point",
            prompt:
              tool === "music"
                ? "A gentle instrumental ambient track with warm piano and soft textures."
                : "A slow cinematic view of a sunlit forest, soft movement and natural light.",
          },
        ];
  const displayed = current?.assets.length
    ? [
        {
          id: current.id,
          kind: "generation" as const,
          title: current.title,
          tool: current.tool,
          favorite: current.favorite,
          updatedAt: current.updatedAt,
          assets: current.assets,
          prompt: current.prompt,
        },
        ...history.filter((h) => h.id !== current.id && h.assets?.length),
      ]
    : history;
  return (
    <>
      <PageHeader
        eyebrow={
          tool === "image"
            ? "A PICTURE BEGINS WITH A THOUGHT"
            : "A LITTLE EXPERIMENT"
        }
        title={
          tool === "image"
            ? "Imagine something."
            : tool === "music"
              ? "Find your sound."
              : "Set an idea in motion."
        }
        description={
          tool === "image"
            ? "Describe what you see in your mind. We’ll help bring it into view."
            : "An optional creative tool, connected to your configured provider."
        }
      />
      <SetupNotice tool={tool} />
      <div className="image-workspace">
        <section className="creation-panel">
          <div className="panel-label">
            <Sparkles size={17} />
            Your idea
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void generate();
            }}
          >
            <label htmlFor="image-prompt">What would you like to create?</label>
            <textarea
              id="image-prompt"
              value={prompt}
              onChange={(e) => draft(e.target.value)}
              placeholder="A place, a feeling, a little detail…"
              maxLength={12000}
              rows={7}
              disabled={!capabilities[tool]}
            />
            {tool === "image" && (
              <>
                <label htmlFor="image-size">Canvas</label>
                <select
                  id="image-size"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  disabled={!capabilities.image}
                >
                  {(capabilities.imageSizes.length
                    ? capabilities.imageSizes
                    : ["1024x1024"]
                  ).map((s) => (
                    <option key={s} value={s}>
                      {s === "1024x1024"
                        ? "Square · 1:1"
                        : s === "1536x1024"
                          ? "Landscape · 3:2"
                          : "Portrait · 2:3"}
                    </option>
                  ))}
                </select>
                <p className="field-hint">
                  One image · Medium quality · Saved privately
                </p>
              </>
            )}
            <button
              className="button full-width"
              disabled={running || !prompt.trim() || !capabilities[tool]}
            >
              <Sparkles size={17} />
              {running ? "Creating…" : `Generate ${tool}`}
            </button>
          </form>
          <div className="preset-list">
            <span className="small-label">NEED A STARTING POINT?</span>
            {presets.map((p) => (
              <button key={p.label} onClick={() => draft(p.prompt)}>
                {p.label}
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
          <p className="creation-note">
            Your creations are saved to your library. Make something you want to
            come back to.
          </p>
        </section>
        <section className="creation-results" aria-label="Generated creations">
          {error && (
            <div className="inline-error" role="alert">
              {error}
            </div>
          )}
          {running && (
            <div role="status" className="generation-progress">
              <span className="pulse-dot" />
              <div>
                <strong>Making room for your imagination</strong>
                <p>
                  {current?.status === "queued" ? "Queued" : "Generating"} ·
                  Your job is saved. You can come back later.
                </p>
              </div>
            </div>
          )}
          {displayed.length ? (
            <>
              <div className="section-heading">
                <h2>Your creations</h2>
                <span className="muted">Saved for later</span>
              </div>
              <div className="creation-grid">
                {displayed.map((item) =>
                  item.assets?.map((asset) => (
                    <article className="creation-card" key={asset.id}>
                      {asset.mime.startsWith("image/") ? (
                        <button
                          className="creation-image"
                          onClick={() =>
                            setPreview({
                              asset,
                              prompt: item.prompt || item.title,
                            })
                          }
                          aria-label={`Preview ${item.title}`}
                        >
                          <img
                            src={`/api/assets/${asset.id}`}
                            alt={item.prompt || item.title}
                            width={600}
                            height={600}
                            loading="lazy"
                          />
                          <span>
                            <Maximize2 size={16} />
                          </span>
                        </button>
                      ) : asset.mime.startsWith("audio/") ? (
                        <audio controls src={`/api/assets/${asset.id}`} />
                      ) : (
                        <video
                          controls
                          preload="metadata"
                          src={`/api/assets/${asset.id}`}
                        />
                      )}
                      <div className="creation-meta">
                        <p>{item.prompt || item.title}</p>
                        <div>
                          <button
                            className="text-button"
                            onClick={() => draft(item.prompt || item.title)}
                          >
                            <RotateCcw size={14} />
                            Reuse prompt
                          </button>
                          <a
                            className="icon-button"
                            href={`/api/assets/${asset.id}?download=1`}
                            aria-label="Download creation"
                          >
                            <Download size={16} />
                          </a>
                        </div>
                      </div>
                    </article>
                  )),
                )}
              </div>
            </>
          ) : !running ? (
            <div className="image-empty">
              <div className="empty-canvas">
                <ImageIcon size={42} />
                <span>YOUR NEXT CREATION</span>
              </div>
              <h2>A blank canvas. A fresh possibility.</h2>
              <p>Start with a few words, or borrow a prompt to get going.</p>
            </div>
          ) : null}
        </section>
      </div>
      <Dialog
        open={!!preview}
        onOpenChange={(v) => {
          if (!v) setPreview(null);
        }}
      >
        <DialogContent className="preview-dialog">
          <DialogTitle>Image preview</DialogTitle>
          <DialogDescription>{preview?.prompt}</DialogDescription>
          {preview && (
            <>
              <img
                src={`/api/assets/${preview.asset.id}`}
                alt={preview.prompt}
                width={1024}
                height={1024}
              />
              <a
                className="button"
                href={`/api/assets/${preview.asset.id}?download=1`}
              >
                <Download size={16} />
                Download image
              </a>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
