# Substack API Reference (Unofficial)

A practical, verified reference for Substack's undocumented internal API. Every
endpoint here has been tested against the live API. Designed for humans AND
for AI agents (see [`SKILL.md`](SKILL.md)).

> ⚠️ **Unofficial.** Substack doesn't publish or support this API. Endpoints
> can change without notice. Treat this as a working notebook, not a contract.

## Why this exists

The Substack web app speaks to a JSON API at `https://substack.com/api/v1/*` and
per-publication subdomains at `https://<sub>.substack.com/api/v1/*`. The web
app uses it for everything: reading posts, creating drafts, publishing, managing
subscribers. With a session cookie, you can drive the same API from any script.

Existing community work covers parts of this surface:

- [NHagar/substack_api](https://github.com/NHagar/substack_api) — Python, read-focused
- [ma2za/python-substack](https://github.com/ma2za/python-substack) — Python, full CRUD
- [jakub-k-slys/substack-api](https://github.com/jakub-k-slys/substack-api) — TypeScript (archived)
- [JPres-Projects/Substack-API](https://github.com/JPres-Projects/Substack-API) — Python, draft + publish

This repo aims to be the **canonical endpoint reference** these clients converge
on. Submit a PR with anything new you find.

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

## Contents

- [`AUTH.md`](AUTH.md) — getting the cookie, cookie format, rotation
- [`ENDPOINTS.md`](ENDPOINTS.md) — every verified endpoint with params + samples
- [`SKILL.md`](SKILL.md) — Claude Agent SDK skill manifest
- [`examples/curl/`](examples/curl) — drop-in curl scripts
- [`examples/typescript/`](examples/typescript) — minimal typed client

## Verified vs. inferred

Each endpoint in [`ENDPOINTS.md`](ENDPOINTS.md) is marked:

- ✅ **Verified** — I personally tested it with curl
- 🟡 **Reported** — documented by another client / blog post, not independently re-tested
- ❓ **Inferred** — pattern-matched from related endpoints, no confirmation

PRs welcome to upgrade ❓ → 🟡 → ✅.

## Status

This reference covers the endpoints needed for:
- ✅ Authentication: cookie + magic-link login
- ✅ Account discovery, blocked users, public profile
- ✅ Listing user's publications (with role)
- ✅ Drafts: create, update, delete, publish, schedule, counts
- ✅ Reading published posts + admin post management
- ✅ Subscribers: list (filter/sort/paginate), add, remove, import status
- ✅ Notes: create, list, profile feed, home feed, delete, seen
- ✅ Reader comments on posts: list, create, delete, moderation reasons
- ✅ Analytics: publication summary, per-post stats (31 fields), email
  timeseries, network attribution, payment pledges
- ✅ Tags + sections: per-post tags, publication-level tags, sections
- ✅ DMs / messages: inbox + unread count
- ✅ Recommendations (cross-pub promotion): listing
- ✅ Paid subscriptions: Stripe account status, pledge plan tiers
- ✅ Inbox & reader feed: posts inbox, Notes feed, tabs, search modules,
  global search
- ✅ Reactions catalog, comment moderation enum, per-post mute settings
- ✅ Image upload
- ✅ Publication CRUD: read, update (single field per `PUT`), captcha-gated create
- ✅ Publication settings (`/publication_settings`): boolean toggle read/write
- ✅ Recommendations (full surface): list, suggested, edge check, stats, search, **add/remove**
- ✅ Audio upload (S3 presigned multipart pattern); audio is used for podcasts too
- ✅ Substack Chat (writer chats / threads): enable + disable + send + delete thread
- ✅ Post reactions: react + unreact
- ✅ Welcome email body via PUT /publication
- ✅ User settings: PUT /user-setting generic key-value setter
- 🟡 Cross-posting auth (YouTube / LinkedIn) — read endpoints mapped
- 🟡 Live streams — read endpoints + eligible hosts
- ❓ Audio / video / podcast upload (likely S3-presigned)
- ❓ Substack Chat (writer chats)
- ❓ Custom domain config
- ❓ Welcome email + auto-sequences

## License

MIT. See [`LICENSE`](LICENSE).
