"use client";
import { useEffect, useState } from "react";
import { Check, Circle, ShieldCheck } from "lucide-react";
import { PageHeader, ThemeSelect, useWorkspace } from "./shell";
import { api } from "./client";
export function Settings() {
  const { capabilities } = useWorkspace(),
    [usageLoaded, setUsageLoaded] = useState(false),
    [usage, setUsage] = useState<{
      count: number;
      limit: number;
      inputTokens: number;
      outputTokens: number;
    } | null>(null);
  useEffect(() => {
    api<typeof usage>("/api/usage")
      .then(setUsage)
      .catch(() => {})
      .finally(() => setUsageLoaded(true));
  }, []);
  return (
    <>
      <PageHeader
        eyebrow="MAKE YOURSELF AT HOME"
        title="Your workspace."
        description="A few preferences, your connections, and a clear view of usage."
      />
      <div className="settings-grid">
        <section className="settings-panel">
          <h2>Look and feel</h2>
          <p>Choose a light, dark, or system appearance.</p>
          <ThemeSelect />
          <hr />
          <h2>
            <ShieldCheck size={18} />
            Private by design
          </h2>
          <p>
            Only configured owners can access this workspace. Each owner’s
            history and files are kept separate.
          </p>
          <p>
            Provider credentials are configured on the server, never in your
            browser.
          </p>
        </section>
        <section className="settings-panel">
          <h2>Today’s usage</h2>
          <p>Requests reset at midnight UTC.</p>
          <div className="usage-number">
            {usage?.count ?? "—"}
            <span> / {capabilities.dailyLimit}</span>
          </div>
          <p>
            {usage
              ? `${usage.inputTokens.toLocaleString()} input tokens · ${usage.outputTokens.toLocaleString()} output tokens`
              : usageLoaded
                ? "Usage is unavailable. Check the database connection."
                : "Loading usage…"}
          </p>
          <div className="notice small-notice">
            One generation at a time. Submitted requests count toward your
            limit, including failed or stopped work. Provider billing may
            differ; this is not a dollar spending cap.
          </div>
        </section>
        <section className="settings-panel wide">
          <h2>Workspace connections</h2>
          <p>
            Configured tools appear in your workspace. Provider configuration
            does not guarantee live service availability.
          </p>
          <div className="connection-list">
            <div>
              <span>
                <ShieldCheck size={16} />
                <strong>Clerk sign-in</strong>
              </span>
              <span className="status-badge ready">Signed in</span>
            </div>
            <div>
              <span>
                <Circle size={16} />
                <strong>Saved history</strong>
              </span>
              <span className={`status-badge ${usage ? "ready" : ""}`}>
                {usage
                  ? "Connected"
                  : usageLoaded
                    ? "Unavailable"
                    : "Checking…"}
              </span>
            </div>
            {(["chat", "code", "image", "music", "video"] as const)
              .filter((t) => t === "chat" || t === "code" || capabilities[t])
              .map((t) => (
                <div key={t}>
                  <span>
                    {capabilities[t] ? (
                      <Check size={16} />
                    ) : (
                      <Circle size={16} />
                    )}
                    <strong>{t[0].toUpperCase() + t.slice(1)}</strong>
                  </span>
                  <span
                    className={`status-badge ${capabilities[t] ? "ready" : ""}`}
                  >
                    {capabilities[t] ? "Configured" : "Not configured"}
                  </span>
                </div>
              ))}
          </div>
          {capabilities.missing.map((s) => (
            <p className="setup-detail" key={s}>
              {s}
            </p>
          ))}
          {(["image", "music", "video"] as const).some(
            (tool) => !capabilities[tool],
          ) && (
            <details className="deferred-tools">
              <summary>Deferred tools</summary>
              <p>
                Optional tools are hidden from navigation and creation shortcuts
                until configured. They are not required for Chat or Code.
              </p>
              <div className="connection-list">
                {(["image", "music", "video"] as const)
                  .filter((tool) => !capabilities[tool])
                  .map((tool) => (
                    <div key={tool}>
                      <span>
                        <Circle size={16} />
                        <strong>
                          {tool === "image"
                            ? "Images"
                            : tool === "music"
                              ? "Music"
                              : "Video"}
                        </strong>
                      </span>
                      <span className="status-badge">Deferred</span>
                    </div>
                  ))}
              </div>
              <p>
                Images need an image model and private file storage. Music and
                video also need a verified provider configuration. Setup
                instructions remain in the README for when you’re ready.
              </p>
            </details>
          )}
        </section>
      </div>
    </>
  );
}
