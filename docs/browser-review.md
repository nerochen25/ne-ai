# Browser review — October 10, 2026

Checked locally with Playwright controlling Google Chrome in a temporary profile, signed in through the real Clerk flow. No authentication bypass or permanent test suite was added. Playwright and axe dependencies and scripts were installed only under `/tmp/neai-browser-check`.

## Implemented

- Chat can use OpenAI web search for current information. Code remains text-only. Search is enabled by default, can be disabled with `OPENAI_WEB_SEARCH=false`, and is bounded to three tool calls per response.
- Provider citation annotations become clickable inline Markdown links and persist with saved messages, copy, and export. If annotations are absent, available search-source URLs appear under “Sources consulted.” If the provider returns neither, the answer explicitly says no source links were returned.
- Search progress is visible and announced to assistive technology.
- Library search synchronizes with a new URL query when the command-search dialog is used on the Library page.
- The Next.js development badge no longer blocks theme buttons.
- Mobile navigation has an accessible description. Failed/stopped messages have a retry action after reload. Retry restores the prompt and focuses the composer without automatically submitting another paid request.
- Conversation headings occupy at most two lines; their full text remains in the DOM and title attribute.

## Verified in Chrome

| Area                                        | Result                                                                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Welcome page                                | No horizontal overflow at widths 320, 390, 768, and 1440; no page exceptions; automated accessibility scan passed.                                                              |
| Home, Chat, Code, Images, Library, Settings | All 24 page/width combinations had no horizontal overflow. Main-content accessibility checks passed at desktop and phone widths.                                                |
| Dark theme                                  | Full-page accessibility scans passed on all six workspace pages; drawer scan also passed. Theme selection survived reload.                                                      |
| Mobile drawer                               | Navigation closes the drawer; Escape closes it and restores focus to its trigger.                                                                                               |
| Keyboard/composer                           | Command-K opens search; Shift-Enter inserts a newline; blank submit is disabled; draft survives reload.                                                                         |
| Saved history                               | Existing conversation and messages were present in MySQL. Newly generated responses survived browser reload.                                                                    |
| Live Chat/search                            | Weather and documentation queries completed through the real application. Documentation answer had clickable source links, retained after reload.                               |
| Library                                     | Rename, favorite, search, export, delete cancellation, and confirmed deletion passed using QA data. Exported JSON downloaded to disk and contained the expected saved response. |
| Error/retry                                 | A browser-intercepted 503 preserved the draft and returned focus through Retry. This was a simulated failure, not a live provider outage.                                       |
| Code                                        | Live fenced JavaScript response highlighted correctly; Copy reported success; response fit a 320px viewport. Generated code was not executed.                                   |
| Stop/recovery                               | Stopping a live response saved its partial output with cancelled status. Reload retained it; Retry restored its prompt and focused the composer.                                |
| Access control                              | Signed-out private page requested sign-in; signed-out Library API returned 401.                                                                                                 |
| Images setup                                | Missing image/storage configuration was visible and generation was disabled.                                                                                                    |
| Final mobile layout                         | Long conversation heading fit two lines; cited answer had no horizontal overflow.                                                                                               |

Only expected Clerk development-key warnings appeared during the completed interaction checks. Automated accessibility scans are not a substitute for a full manual screen-reader audit.

## Limits and cleanup

- Weather searches in this run returned no citation annotations or source URLs. The application now discloses that limitation instead of rendering an empty link. Forecast accuracy was not independently validated.
- Live image generation/download and music/video were not verified because their services are unconfigured.
- Mobile checks used Chrome viewport emulation, not physical iOS/Android devices. Safari/Firefox, virtual-keyboard behavior, production hosting, and load performance were not tested.
- Cross-owner access and simultaneous-session races were not part of this browser review.
- QA conversations were deleted after checking them; the original conversation was preserved. Generation usage records remain, as intended. Live checks incurred provider usage; stopping does not guarantee zero cost.
- No remote database changes, deployment, or permanent automated coverage were added.

## Build checks

Prettier, lint, TypeScript, and the production build were checked. An initial sandbox worker-port error was cached by Turbopack; moving aside only the failed build cache allowed the normal `npm run build` to succeed. Webpack also built successfully during diagnosis.

Web-search integration follows the [official OpenAI Responses API web-search documentation](https://developers.openai.com/api/docs/guides/tools-web-search).
