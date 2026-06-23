# Substack API Endpoints

Every endpoint below is classified:
- ✅ **Verified** — tested with curl in 2026, response structure documented
- 🟡 **Reported** — documented in another client; not personally re-tested
- ❓ **Inferred** — pattern-guess; no successful call observed
- ❌ **Doesn't exist** — tested and confirmed 404; documented to save you the time

Base hosts:
- **`substack.com`** — account-wide endpoints (your profile, settings, global feed)
- **`{subdomain}.substack.com`** — publication-scoped endpoints (drafts, posts, tags)

All endpoints require the [auth cookie](AUTH.md) unless marked otherwise.

---

## Account & user

### ✅ `GET /api/v1/user/profile/self`
**Host:** `substack.com`
**Returns:** Your profile + every publication you have a role on.

```json
{
  "id": 12345,
  "name": "Your Name",
  "handle": "yourhandle",
  "photo_url": "https://...",
  "bio": "...",
  "publicationUsers": [
    {
      "id": 9902568,
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

**Use for:** validating a cookie + discovering owned publications. Single most
useful endpoint in this surface. The `publicationUsers[].id` is your
**publicationUserId** — required when creating drafts (as the byline reference).

### ✅ `GET /api/v1/settings`
**Host:** `substack.com`
**Returns:** Account-level settings (notifications, defaults, etc.).

### ✅ `GET /api/v1/subscriptions?tvOnly=false`
**Host:** `substack.com` or any pub subdomain
**Returns:** Publications you're SUBSCRIBED to (NOT owned — use
`/user/profile/self` for owned).
**Required query:** `tvOnly` (`false` works) — endpoint 400s without it.

```json
{
  "subscriptions": [...],
  "publications": [
    { "id": 2309986, "name": "...", "subdomain": "...", ... }
  ]
}
```

### ✅ `GET /api/v1/reader/posts`
**Host:** `substack.com`
**Returns:** Global reader feed — posts from across publications the user can
see, paginated.

### ✅ `GET /api/v1/categories`
**Host:** `substack.com`
**Returns:** All publication categories (Culture, Tech, etc.). Public — no auth
needed.

---

## Drafts (publication-scoped)

All draft endpoints require admin/editor role on the pub. Returns
`403 Not authorized` if you're just a subscriber.

### ✅ `GET /api/v1/drafts?limit=N`
**Host:** `{subdomain}.substack.com`
**Returns:** Array of draft objects. Use as a "do I have edit access" probe.

### ✅ `GET /api/v1/drafts/{id}`
**Host:** `{subdomain}.substack.com`
**Returns:** Single draft with full content + metadata.

### ✅ `POST /api/v1/drafts`
**Host:** `{subdomain}.substack.com`
**Required body:**
```json
{
  "draft_title": "...",
  "draft_subtitle": "...",
  "draft_body": "<p>HTML or Substack block JSON</p>",
  "type": "newsletter",
  "draft_bylines": [
    { "id": 12345, "publicationUserId": 9902568 }
  ]
}
```
**Important:** `draft_bylines` is **required** (not optional as some docs claim).
Get the IDs from `/user/profile/self` — `id` is your user id,
`publicationUserId` is `publicationUsers[N].id` for the pub.

**Returns:** Created draft with `id`, `draft_title`, `draft_body`, etc.

### ✅ `PUT /api/v1/drafts/{id}`
**Host:** `{subdomain}.substack.com`
**Body:** Same shape as POST. Updates in place — useful for "replace existing
draft" flows that preserve the draft URL in the editor's inbox.

### ✅ `DELETE /api/v1/drafts/{id}`
**Host:** `{subdomain}.substack.com`
**Returns:** `200` on success. `404` if already gone.

### ✅ `PUT /api/v1/drafts/{id}/publish`
**Host:** `{subdomain}.substack.com`
**Body:**
```json
{
  "send": true,
  "share_automatically": false
}
```
**Returns:** Published post with `slug`. `send: true` emails subscribers
immediately — **IRREVERSIBLE**.

### 🟡 `PUT /api/v1/drafts/{id}/prepublish`
**Host:** `{subdomain}.substack.com`
**Reported by:** ma2za/python-substack
**Use:** Pre-flight check before publishing — returns validation issues without
publishing.

### 🟡 `PUT /api/v1/drafts/{id}/schedule`
**Host:** `{subdomain}.substack.com`
**Body:** `{ "post_date": "<ISO datetime>" }` to schedule. `{ "post_date": null }`
to unschedule.

---

## Posts (publication-scoped, admin views)

### ✅ `GET /api/v1/posts?limit=N&offset=N`
**Host:** `{subdomain}.substack.com`
**Public** — no auth required for public posts. Returns published-post listings
for browsing.

### ✅ `GET /api/v1/post_management/published`
**Host:** `{subdomain}.substack.com`
**Required query params:** `offset`, `limit`. Optional: `order_by`
(`post_date`), `order_direction` (`desc`/`asc`).
**Returns:** `{ posts, offset, limit, total, isCapped }`. Admin view with
engagement context.

### 🟡 `GET /api/v1/post_management/scheduled`
**Host:** `{subdomain}.substack.com`
**Required query params:** Same as `published`.
**Returns:** Scheduled-but-not-yet-sent posts.

### 🟡 `GET /api/v1/posts/{slug}`
**Host:** `{subdomain}.substack.com`
**Returns:** Single post by slug, with content. Auth required for
subscriber-only posts.

---

## Publication settings

### ✅ `GET /api/v1/publication/users`
**Host:** `{subdomain}.substack.com`
**Returns:** Users with roles on this publication (admins, editors).

### ✅ `GET /api/v1/publication/post-tag`
**Host:** `{subdomain}.substack.com`
**Returns:** Array of post tags configured for the publication.

### 🟡 `POST /api/v1/publication/post-tag`
**Host:** `{subdomain}.substack.com`
**Body:** `{ name: "..." }` — create a new tag.

### 🟡 `POST /api/v1/post/{post_id}/tag/{tag_id}`
**Host:** `{subdomain}.substack.com`
**Use:** Attach a tag to a post.

### ✅ `GET /api/v1/publication_launch_checklist`
**Host:** `{subdomain}.substack.com`
**Returns:** Onboarding checklist state (about_page completed, first_post
sent, etc.).

### 🟡 `POST /api/v1/image`
**Host:** `{subdomain}.substack.com`
**Body:** Multipart with image file. Returns hosted URL for use in drafts.

---

## Categories

### 🟡 `GET /api/v1/category/public/{category_id}/{category_type}`
**Host:** `substack.com`
**Returns:** Publications in a specific category.

---

## Endpoints that DON'T exist (don't waste your time)

These returned 404 (HTML page) against the live API. Most public references
that list them are wrong — they probably worked in an earlier Substack version.

- ❌ `GET /api/v1/me`
- ❌ `GET /api/v1/account`
- ❌ `GET /api/v1/account/me`
- ❌ `GET /api/v1/profile`
- ❌ `GET /api/v1/users/me`
- ❌ `GET /api/v1/reader/inbox`
- ❌ `GET /api/v1/notes` (might exist scoped differently; not at this path)
- ❌ `GET /api/v1/comments`
- ❌ `GET /api/v1/contacts`
- ❌ `GET /api/v1/free_subscribers`
- ❌ `GET /api/v1/subscribers` (per-pub or root — both 404 / 403)
- ❌ `GET /api/v1/post_management/draft`
- ❌ `GET /api/v1/post_management/stats`
- ❌ `GET /api/v1/stats`

Use `/api/v1/user/profile/self` for "current user" info, not the variants above.

## The 403 "Not authorized" cases

These exist but return 403 even with a valid cookie:

- 🔒 `GET /api/v1/admin/profile`
- 🔒 `GET /api/v1/admin/publications`
- 🔒 `GET /api/v1/user/profile` (note: WITHOUT `/self`)
- 🔒 `GET /api/v1/user/me`
- 🔒 `GET /api/v1/publication` (without ID)
- 🔒 `GET /api/v1/publication/subscriptions` (likely needs Pro plan or higher
  permission tier)

These probably require publication-context that Substack derives from
something we haven't found yet (CSRF token, X-header, internal IP allowlist).
PRs welcome if you crack any.

## Headers cheatsheet

```
Cookie: connect.sid=...; substack.sid=...    # auth
User-Agent: Mozilla/5.0                      # default Node/Python UAs often 403
Content-Type: application/json               # for POST/PUT
Accept: application/json
```

Most data endpoints **don't** require:
- `Origin` / `Referer` headers
- CSRF tokens
- `X-Requested-With` headers

The `/admin/*` paths that 403 might need something more — see the 403 section
above.

## Pagination

Mixed conventions across the surface:
- `limit` (often capped at 100)
- `offset` (zero-indexed)
- `cursor` (for cursor-based endpoints)

Check the response for `total`, `isCapped`, or `next_cursor` fields.

## Error reference

| Status | Meaning |
|---|---|
| `200` | Success |
| `204` | Success, empty body (deletes) |
| `400` | Bad request — body lists which param is invalid/missing |
| `401` | Cookie missing or expired |
| `403` | Cookie valid but you lack permission for this resource |
| `404` (HTML) | Endpoint or resource doesn't exist |
| `404` (JSON `{error: "User not found"}`) | Resource exists but you can't see it |
| `409` | Conflict — name uniqueness violation (rare) |
| `429` | Rate limited — back off and retry |
| `500` | Substack internal — usually transient |

## Contributing

Find a new endpoint? Test with curl, then PR with:
- Method + path
- Required host (`substack.com` vs `{sub}.substack.com`)
- Required headers / query params
- Sample response (sanitize user data)
- Classification (✅ / 🟡 / ❓)
- Date you verified it
