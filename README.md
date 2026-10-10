# NE-AI

A private workspace for conversations, code, and images. Built with Next.js 16, React 19, strict TypeScript, Tailwind CSS 4, Radix UI, Clerk, Prisma/MySQL, and private S3-compatible storage.

## What’s included

- Responsive workspace with recent work, prompt starters, keyboard search (`⌘/Ctrl K`), and system/light/dark themes.
- Saved chat and code conversations, streaming responses, stop, partial-response recovery, copy, syntax highlighting, and Markdown export. Generated code is never executed.
- Image creation, canvas selection, private saved assets, preview, downloads, and prompt reuse.
- Searchable, paginated library with rename, favorites, deletion, and JSON export.
- Owner-only authorization, bounded requests/context, transactional usage reservations, idempotency keys, and request-level errors.
- Optional music/video tools, disabled until a Replicate version and its input/output contract have been verified.

## Local setup

```sh
nvm install
nvm use
npm ci
cp .env.example .env.local
```

Use Node **24.16.0** from `.nvmrc`. Fill in `.env.local` before using the workspace:

| Setting                                                              | Purpose                                                                                                                          |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `APP_URL`                                                            | Canonical app origin, such as `http://localhost:3000` locally or your HTTPS origin in production. Must match the browser origin. |
| `DATABASE_URL`                                                       | A **new, empty MySQL 8** database.                                                                                               |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`              | Clerk application credentials.                                                                                                   |
| `OWNER_CLERK_IDS`                                                    | Comma-separated Clerk user IDs permitted to use the app. Missing/empty denies access.                                            |
| `OPENAI_API_KEY`, `OPENAI_TEXT_MODEL`                                | Server-side OpenAI credentials and an explicitly selected Responses-compatible model.                                            |
| `OPENAI_IMAGE_MODEL`                                                 | An explicitly selected `gpt-image-*` model supporting PNG, medium quality, and the three exposed canvas sizes.                   |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Private object storage. Grant get/put/delete access only to the intended bucket.                                                 |
| `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`                                 | Optional settings for S3-compatible services. The endpoint must be reachable by both the server and browsers using signed URLs.  |
| `S3_SERVER_SIDE_ENCRYPTION`                                          | `AES256` for supported storage; leave empty if your S3-compatible service does not support it.                                   |
| `DAILY_REQUEST_LIMIT`                                                | Requests per owner per UTC day; default 50.                                                                                      |
| `CRON_SECRET`                                                        | Random secret used by the job dispatcher. Configure the scheduler described below.                                               |

Create your Clerk user through Clerk’s dashboard or the sign-up flow, then put its **user ID** in `OWNER_CLERK_IDS`. Signing up alone never grants workspace access. Configure Clerk’s sign-in/sign-up paths from the example environment file.

Prisma CLI loads `.env`, not Next.js’s `.env.local`. Supply `DATABASE_URL` in your shell or a gitignored `.env` when applying migrations:

```sh
# DATABASE_URL must point to your new local database.
npm run db:migrate
npm run dev
```

Open **http://localhost:3000**. With no credentials, the public welcome page and setup notice still render; protected APIs remain inaccessible. Keys stay server-side. Never prefix provider secrets with `NEXT_PUBLIC_`.

This is a fresh-start schema. The migration creates the new workspace tables; it is **not** a migration of the retired SaaS database. Do not point it at an existing production database. No remote database or Stripe changes were made as part of this redesign.

## Cloudflare R2 setup

1. In the [Cloudflare dashboard](https://dash.cloudflare.com/), enable R2 and create a bucket such as `ne-ai-assets`. Keep public access disabled; do not enable an r2.dev URL or a public custom domain.
2. In R2 Overview, open **Manage API Tokens**. Create an R2 token with **Object Read & Write**, scoped only to your new bucket. Copy its **Access Key ID** and **Secret Access Key** directly into `.env.local`.
3. Copy the bucket's **S3 API endpoint** from Cloudflare. Use the exact endpoint shown, including any jurisdiction-specific hostname. The endpoint should not include the bucket name.
4. Set these existing environment entries (replace the placeholders):

```dotenv
S3_BUCKET=ne-ai-assets
S3_REGION=auto
S3_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=YOUR_R2_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY=YOUR_R2_SECRET_ACCESS_KEY
S3_FORCE_PATH_STYLE=false
S3_SERVER_SIDE_ENCRYPTION=
```

R2 encrypts stored data automatically; leave `S3_SERVER_SIDE_ENCRYPTION` empty to omit the AWS-specific encryption request header. Use S3 credentials generated by R2, not a general Cloudflare bearer API token. Do not paste secret values into chat or commit them.

Set `OPENAI_IMAGE_MODEL` only after confirming access to an image model supporting the app's PNG, medium-quality, and canvas-size controls. Restart the development server. Verify storage upload, signed download, and cleanup before a paid image-generation check. The job-dispatch secret and scheduler described below are also needed for recovery when the browser is closed; generating a secret does not start a scheduler.

References: [R2 credentials](https://developers.cloudflare.com/r2/api/tokens/), [AWS SDK configuration](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/), and [S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/).

## Durable generation and usage

A per-owner database row lock serializes quota checks and request reservations across server instances. The defaults are one active generation, five submitted requests per minute, and 50 per UTC day. Submitted requests, including failed or stopped requests, count toward the cap. Deleting work does not erase usage records. Token usage is reported when the provider returns it; incomplete requests and media are not reliable dollar-cost estimates. Configure provider-side spending limits separately.

An idempotency key can only identify one input payload. Network retries with the same key return the saved job instead of generating again. A deliberate new generation uses a new key. Provider calls are not automatically retried: a network failure can be ambiguous about whether a provider accepted or charged a request.

Chat enables the OpenAI `web_search` tool by default, with at most three tool calls per response. The model chooses when to search; a live search requires support from your configured model and API project. Set `OPENAI_WEB_SEARCH=false` to disable it. Code remains text-only. Search calls incur additional provider charges and may send search queries to the search service; the daily request counter is not a search-call or dollar-cost meter. Provider citation annotations become clickable inline Markdown links saved with the conversation, including in copy and export. The composer shows search progress while the tool runs.

Chat sends bounded server-stored history to the Responses API with `store: false`. Partial assistant output is checkpointed while streaming. Stop requests cancel the stream and request server-side cancellation, but cannot guarantee that provider billing stops immediately. The app keeps its own history; provider-side retention remains subject to your provider settings.

Media requests create persisted jobs and return HTTP 202. `after()` starts work after the response; the app polls job status while open. Deploy on a Node.js host that supports Next.js `after()` and at least a **300-second request lifetime**. A static export is not supported.

Configure an authenticated scheduler to call the following endpoint **every minute**, even when no browser is open:

```text
GET https://your-app.example/api/jobs/dispatch
Authorization: Bearer <CRON_SECRET>
```

The dispatcher recovers queued media jobs, polls Replicate, and marks abandoned jobs failed after ten minutes without progress. It does not automatically repeat an ambiguous provider request. Configure the scheduler yourself on your deployment platform; no schedules or deployments are created by this repository. Monitor dispatcher HTTP failures and structured server error request IDs.

Generated images/files are copied into private object storage before a job completes. Asset access requires an owner session and returns a signed URL valid for 60 seconds. Downloads use attachment disposition. Deleted media are removed from the bucket; bucket version retention/lifecycle rules remain the storage operator’s responsibility.

### Optional music and video

Set `REPLICATE_API_TOKEN`, a 64-character version hash in `REPLICATE_MUSIC_VERSION` / `REPLICATE_VIDEO_VERSION`, and the model’s prompt input field. Set the matching `*_VERIFIED=true` only after confirming that the selected model accepts that prompt field and defaults for other inputs. Output must be a Replicate delivery URL, an array whose first item is that URL, or an `{ "audio": "..." }` object. Supported files are MP3/WAV audio or MP4 video, at most 50 MB. Unsupported output is reported as a failed job. These tools are deliberately absent from navigation until configured.

## Development and checks

```sh
npm run format        # Prettier rewrites supported files
npm run format:check  # Check formatting without changing files
npm run lint
npm run typecheck
npm run build
```

**Automated test coverage is deferred at the owner’s request.** No test runner, browser-test suite, or authentication bypass is included. CI runs formatting, lint, typecheck, and build only. Live Clerk, OpenAI, MySQL, S3, and Replicate integration verification requires your configured services and is separate from a successful build.

`npm run db:generate` refreshes Prisma types; `npx prisma format` formats the Prisma schema. Prettier formats JavaScript, TypeScript, CSS, JSON, YAML, and Markdown. The `deepmerge-ts` override patches a development dependency used by Prisma’s configuration tooling.

## Structure and API

- `app/`: routes, server shells, and owner-protected HTTP handlers.
- `features/`: workspace, shared chat/code, image/media creation, and library interfaces.
- `lib/server/`: auth, configuration, validation, provider adapters, persistence, usage, generation jobs, and storage.
- `lib/types.ts`: application-owned data and streaming contracts.
- `prisma/`: relational schema and initial migration.

| Endpoint                                      | Behavior                                                                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/conversation`, `/api/code`         | `{ prompt, conversationId?, idempotencyKey }`; NDJSON `start`, `delta`, `done`, `error` events, or JSON for a duplicate request. |
| `POST /api/image`, `/api/music`, `/api/video` | `{ prompt, idempotencyKey, size? }`; persisted generation and `reused` flag.                                                     |
| `GET /api/conversations/:id`                  | Owner’s conversation and stored messages.                                                                                        |
| `GET /api/generations/:id`                    | Read job status and assets.                                                                                                      |
| `POST /api/generations/:id`                   | Resume queued media dispatch or refresh a provider job.                                                                          |
| `POST /api/generations/:id/cancel`            | Request cancellation of active text generation.                                                                                  |
| `GET /api/library`                            | `q`, `page`, `tool`, `favorite`; 18 items per page.                                                                              |
| `PATCH /api/items/:kind/:id`                  | Rename or favorite a conversation/generation.                                                                                    |
| `DELETE /api/items/:kind/:id`                 | Delete an inactive item.                                                                                                         |
| `GET /api/items/:kind/:id`                    | Download JSON export.                                                                                                            |
| `GET /api/assets/:id?download=1`              | Authenticated asset download.                                                                                                    |
| `GET /api/usage`                              | Current owner’s UTC-day request and reported token usage.                                                                        |

## Deployment checklist

1. Provision a new MySQL database and private S3-compatible bucket. Back up data and set bucket retention policies.
2. Configure production Clerk keys, owner IDs, canonical `APP_URL`, provider models, and server secrets.
3. Run `npm ci`, apply migrations to the intended new database, then `npm run build` and `npm start`.
4. Configure the authenticated minute-level dispatcher and a 300-second request lifetime; disable response buffering for NDJSON streams.
5. Verify sign-in denial for non-owners, saved chat after reload, partial-response recovery, asset downloads, and media job completion with your real service accounts before relying on the deployment.

Next improvements after the essentials are validated: document-grounded answers, richer conversation organization, and additional model providers. Billing, teams, code execution, and autonomous agents are outside this release.
