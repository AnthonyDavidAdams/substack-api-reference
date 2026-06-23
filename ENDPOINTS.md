# Substack API Endpoints

Every endpoint below has been classified:
- ✅ **Verified** — tested with curl in 2026
- 🟡 **Reported** — documented in another client; not personally re-tested
- ❓ **Inferred** — pattern-guess from related endpoints

Base hosts:
- **`substack.com`** — account-wide endpoints (your profile, subscriptions, etc.)
- **`{subdomain}.substack.com`** — publication-scoped endpoints (drafts, posts, subscribers)

All endpoints require the [auth cookie](AUTH.md) unless marked otherwise.

---

## Account & user

### ✅ `GET /api/v1/user/profile/self`
**Host:** `substack.com`
**Returns:** Your profile + every publication you can edit.

```json
{
  "id": 12345,
  "name": "Your Name",
  "handle": "yourhandle",
  "photo_url": "https://...",
  "bio": "...",
  "publicationUsers": [
    {
      "publication": {
        "id": 99999,
        "name": "Your Newsletter",
        "subdomain": "yournewsletter",
        "logo_url": "https://..."
      },
      "role": "admin",
      "is_primary": true
    }
  ]
}
```

**Use for:** validating a cookie + discovering owned publications. This is the
single most useful endpoint for any tool integrating with Substack.

### ✅ `GET /api/v1/subscriptions?tvOnly=false`
**Host:** `substack.com` or any pub subdomain
**Returns:** Publications you're subscribed to (not owned).
**Required query:** `tvOnly` (`false` works) — endpoint 400s without it.

```json
{
  "subscriptions": [...],
  "publications": [
    { "id": 2309986, "name": "Some Newsletter", "subdomain": "somenewsletter", ... }
  ]
}
```

---

## Drafts (publication-scoped)

All draft endpoints live on the publication's subdomain. Requires admin/editor
role on that pub — otherwise returns `403 Not authorized`.

### ✅ `POST /api/v1/drafts`
**Host:** `{subdomain}.substack.com`
**Body:**
```json
{
  "draft_title": "...",
  "draft_subtitle": "...",
  "draft_body": "<p>HTML or Substack's content-block JSON</p>",
  "type": "newsletter"
}
```
**Returns:** Created draft object with `id`, `slug`, etc.

### 🟡 `PUT /api/v1/drafts/{id}`
**Host:** `{subdomain}.substack.com`
**Body:** Same as POST. Updates the draft in place — useful for "replace
existing draft" flows that preserve the draft URL.

### 🟡 `DELETE /api/v1/drafts/{id}`
**Host:** `{subdomain}.substack.com`
**Returns:** `204` on success, `404` if already gone.

### ✅ `PUT /api/v1/drafts/{id}/publish`
**Host:** `{subdomain}.substack.com`
**Body:**
```json
{
  "send": true,
  "share_automatically": false
}
```
**Returns:** Published post object with `slug`. Email goes out to subscribers
when `send: true`.

### ✅ `GET /api/v1/drafts?limit=N`
**Host:** `{subdomain}.substack.com`
**Returns:** Array of draft objects. `403` if you don't have edit access —
useful as an "is the user actually an admin here" probe.

---

## Posts (read-only)

### ✅ `GET /api/v1/posts?limit=N&offset=N`
**Host:** `{subdomain}.substack.com`
**Public** — no auth required for public posts. Returns published-post
listings for browsing.

### 🟡 `GET /api/v1/posts/{slug}`
**Host:** `{subdomain}.substack.com`
**Returns:** Single post by slug, including content. Auth required for
subscriber-only posts.

### 🟡 `GET /api/v1/post_management/published`
**Host:** `{subdomain}.substack.com`
**Returns:** Admin view of published posts with engagement metrics.
Query params: `offset`, `limit`, `order_by` (`post_date`), `order_direction`
(`asc`/`desc`).

---

## Publication settings

### 🟡 `GET /api/v1/publication/users`
**Host:** `{subdomain}.substack.com`
**Returns:** Users with roles on this publication (admins, editors).

### 🟡 `GET /api/v1/subscribers`
**Host:** `{subdomain}.substack.com`
**Returns:** Paginated subscriber list. Admin-only.

### 🟡 `GET /api/v1/settings`
**Host:** `substack.com`
**Returns:** Account-level settings (notifications, etc.).

---

## Notes (Substack's micro-blogging surface)

### 🟡 `GET /api/v1/notes?cursor=...`
**Host:** `substack.com`
**Returns:** Notes feed. Cursor-based pagination.

### ❓ `POST /api/v1/notes`
**Host:** `substack.com`
**Body:** `{ bodyJson: { ... }, replyMinimumRole: "everyone" }` (inferred)
**Note:** Substack's note body is a structured JSON tree (block-based), not
plain HTML. Format borrowed from their editor's content model.

---

## Common 404 traps

Endpoints that LOOK like they should exist but don't (verified absent against
substack.com root):

- ❌ `/api/v1/me`
- ❌ `/api/v1/account`
- ❌ `/api/v1/profile`
- ❌ `/api/v1/users/me`
- ❌ `/api/v1/reader/inbox`

These all return Substack's 404 HTML page. Use `/api/v1/user/profile/self`
instead.

## Headers cheatsheet

```
Cookie: connect.sid=...; substack.sid=...     # auth
User-Agent: Mozilla/5.0                       # default Node/curl UAs often 403
Content-Type: application/json                # for POST/PUT
Accept: application/json
```

Most endpoints **don't** require:
- `Origin` / `Referer` headers (CORS isn't enforced server-side for these)
- CSRF tokens (cookie-only auth is accepted on all data endpoints)
- `X-Requested-With` headers

The `/admin/*` and `/user/profile` paths that 403 with just a cookie probably
need a publication-context that Substack derives from the subdomain. Try the
same path on a `{sub}.substack.com` host before assuming auth is the issue.

## Pagination

Most list endpoints use:
- `limit` (often capped at 100)
- `offset` (zero-indexed) — for offset-based endpoints
- `cursor` — for cursor-based endpoints like `/notes`

Mix is inconsistent across the surface; check the response for `next_cursor`
or `total` fields.

## Errors

| Status | What it usually means |
|---|---|
| `200` | Success |
| `204` | Success, empty body (deletes) |
| `400` | Bad request — usually missing required query param. Body lists which param. |
| `401` | Cookie missing or expired |
| `403` | Cookie valid but you lack permission for this resource |
| `404` | Endpoint or resource doesn't exist. Substack returns HTML, not JSON. |
| `409` | Conflict — usually a name uniqueness violation (campaign/draft titles) |
| `429` | Rate limited — back off and retry |

## Contributing

Find a new endpoint? Verify it with curl, then PR with:
- Method + path
- Required host (`substack.com` vs `{sub}.substack.com`)
- Required headers / query params
- Sample response (sanitize any user data)
- Classification (✅ / 🟡 / ❓)
