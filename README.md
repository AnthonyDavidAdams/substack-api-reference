# Substack API Reference (Unofficial)

> The most complete map of Substack's undocumented internal API. **129 verified endpoints**, captured by driving the live API through 14 rounds of probing and write-side capture.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Endpoints](https://img.shields.io/badge/Endpoints-129%20verified-brightgreen)
![Rounds](https://img.shields.io/badge/Capture%20rounds-14-blue)

A practical, verified reference for Substack's undocumented internal API. Every endpoint here has been tested against the live API. Designed for humans **and** for AI agents (see [`SKILL.md`](SKILL.md)).

> ⚠️ **Unofficial.** Substack doesn't publish or support this API. Endpoints can change without notice. Treat this as a working notebook, not a contract.

---

## Why this exists

The Substack web app speaks to a JSON API at `https://substack.com/api/v1/*` and per-publication subdomains at `https://<sub>.substack.com/api/v1/*`. The web app uses it for everything: reading posts, creating drafts, publishing, managing subscribers, sending chat threads, configuring recommendations. With a session cookie, you can drive the same API from any script.

Existing community work covers parts of this surface:

- [NHagar/substack_api](https://github.com/NHagar/substack_api) — Python, read-focused
- [ma2za/python-substack](https://github.com/ma2za/python-substack) — Python, full CRUD
- [jakub-k-slys/substack-api](https://github.com/jakub-k-slys/substack-api) — TypeScript (archived)
- [JPres-Projects/Substack-API](https://github.com/JPres-Projects/Substack-API) — Python, draft + publish

This repo is intended to be **the canonical endpoint reference** these clients converge on. Submit a PR with anything new you find.

---

## Quick start

```bash
# 1. Get your session cookie (see AUTH.md for browser-extension and DevTools paths)
COOKIE='s%3A...your.connect.sid.value...'

# 2. Verify it's good — returns your profile + every publication you can edit
curl -H "Cookie: connect.sid=$COOKIE; substack.sid=$COOKIE" \
  https://substack.com/api/v1/user/profile/self | jq .handle

# 3. Create a draft on a publication you admin
curl -X POST \
  -H "Cookie: connect.sid=$COOKIE; substack.sid=$COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"draft_title":"Hello","draft_subtitle":"From the API","draft_body":"<p>Hi.</p>","type":"newsletter"}' \
  https://yourname.substack.com/api/v1/drafts
```

---

## Contents

- [`ENDPOINTS.md`](ENDPOINTS.md) — every verified endpoint with body shapes, query params, and sample responses
- [`AUTH.md`](AUTH.md) — getting the cookie, format, rotation, sending it from server-side code
- [`SKILL.md`](SKILL.md) — Claude Agent SDK skill manifest
- [`examples/curl/`](examples/curl) — drop-in curl scripts
- [`examples/typescript/`](examples/typescript) — minimal typed client

---

## What's covered

**Read side (passive — works with just a cookie):**
- Authentication, account discovery, public profile, blocked users
- Publication CRUD (read), settings, sections, tags, recommendations, Stripe status, pledge tiers
- Drafts, scheduled posts, published posts, post management counts
- Per-post stats (31 engagement fields including open rate, CTR, daily breakdowns, referrers)
- Publication-wide analytics (subscribers, ARR, network attribution, growth sources/events timeseries)
- Subscribers list (filter/sort/paginate), DMs/messages inbox, activity feed
- Reader inbox (`/inbox/top`), Notes feed + tabs, global search, search modules
- Categories, reactions catalog, comment moderation enum, per-post mute settings

**Write side (captured by driving the UI through Chrome):**
- `PUT /publication` — single-field saves (`name`, `hero_text`, `language`, `welcome_email_content`, …)
- `PUT /publication_settings` — boolean toggles (high-res video, AI training opt-out, cross-posting, etc.)
- Drafts: create, update, delete, publish, schedule, scheduled_release
- Notes: create (`POST /comment/feed`), delete, mark-seen
- Reader comments: create, delete; **post reactions** (literal emoji + `surface`)
- **Recommendations**: add (`PUT /recommendations`), remove (`DELETE /recommendations/` — note trailing slash), search, suggested
- **Audio/podcast upload** — full S3 presigned multipart sequence (init → S3 PUT → transcode → poll)
- **Substack Chat**: enable/disable (`/publication_threads_settings`), send thread (client-generated UUID), delete thread
- Co-author invites, subscriber add/remove, post-tag attach/detach, image upload
- Generic user setting (`PUT /user-setting`)

**Known gates (documented but won't be cracked here):**
- `POST /publication` — captcha-gated by design
- Custom domain config — $50 one-time + DNS setup
- Magic-link verify — at `/sign-in?token=...`, not under `/api/v1/*`
- Moderator-delete-with-reason — needs another user's comment to surface

---

## Verified vs. inferred

Each endpoint in [`ENDPOINTS.md`](ENDPOINTS.md) is marked:

- ✅ **Verified** — personally tested against the live API
- 🟡 **Reported** — documented by another client / blog post, not independently re-tested
- ❓ **Inferred** — pattern-matched from related endpoints, no successful call observed
- ❌ **Dead** — tested and confirmed 404, documented to save you the time
- 🔒 **Gated** — exists but returns 403 from a plain curl (often works from a real browser; see the "two-host trick" and "browser-vs-curl gap" notes in `ENDPOINTS.md`)

PRs welcome to upgrade ❓ → 🟡 → ✅.

---

## How this was built

This reference was built over 14 progressive rounds of capture, documented as `Round N` commits. The methodology stack:

1. **Curl probing** for read endpoints + empirical-error field discovery (sending intentionally-invalid POSTs to surface required fields via Substack's error messages — that's how `trigger_at` was found, and dozens of others)
2. **Playwright headless capture** — driving Chromium with a session cookie through the admin SPA to log every `api/v1` request that fires
3. **Chrome extension live capture** ([Claude in Chrome](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn)) — monkey-patching `window.fetch` and `XMLHttpRequest.send` from a `localStorage`-backed log so request bodies survive React-driven page reloads, then doing add-then-revert cycles on real publication actions to capture the write-side bodies that couldn't be reached passively

Why all three: passive observation gets you read endpoints and a lot of POST bodies "for free." Empirical probing fills the gaps where errors are descriptive (Substack's are). Live driving the UI catches the cases where the body shape is non-obvious (the literal-emoji reaction value, the client-generated UUID for thread sends, the stringified-ProseMirror welcome email content) and where endpoints 403 from curl but 200 from a real browser session (recommendations was the canonical example).

---

## Contributing

Found a new endpoint? Test with curl, then PR with:

- Method + path
- Required host (`substack.com` vs `{sub}.substack.com`)
- Required headers / query params
- Sample response (sanitize user data)
- Classification (✅ / 🟡 / ❓)
- Date you verified it

Capture playbook for body shapes you can't get from curl:

1. Open Substack in Chrome → DevTools → Network → filter to `Fetch/XHR`
2. Perform the action in the UI
3. The matching request appears in Network → right-click → **Copy as cURL**
4. Strip the cookie + headers down to the minimum that still works
5. PR the result here

---

## Who built this

This reference was assembled by [Anthony David Adams](https://substack.com/@anthonydavidadams) and the [**EarthPilot.ai Lab**](https://earthpilot.ai) — a small applied-AI lab building Mission Support for Spaceship Earth: tools and protocols for sense-making, decision-making, and coordination at planetary scale. Working on Substack-adjacent infrastructure (newsletter platforms, AI editorial pipelines, growth tooling) pushed us to map this surface; sharing it back is the natural thing to do.

### Singularity Playground

If you're working at the edge of AI × meaning × infrastructure — or you want to be — come hang out at the **[Singularity Playground](https://earthpilot.co/play)**. It's our open community for builders, researchers, and writers working on what comes next. Free to join, no pitch deck required.

---

## License

MIT. See [`LICENSE`](LICENSE).
