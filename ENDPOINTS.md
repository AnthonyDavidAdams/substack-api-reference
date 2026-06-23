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

### ✅ `GET /api/v1/drafts/{id}/prepublish`
**Host:** `{subdomain}.substack.com`
**Optional query:** `publish_date=<ISO datetime>` — when scheduling, the web
app passes the proposed time so prepublish can validate it.
**Returns:** `{ errors: [...], suggestions: [...] }` — pre-flight check.
Empty arrays = ready to publish.

**Note:** The verb is **GET**, not PUT/POST as some older clients say.

### ✅ Scheduling: `POST /api/v1/drafts/{id}/scheduled_release`
**Host:** `{subdomain}.substack.com`
**Body:**
```json
{
  "trigger_at": "2027-01-01T12:00:00.000Z",
  "post_audience": "everyone"
}
```
**Returns:** The draft object with scheduling info attached.
**Critical:** The field name is **`trigger_at`**, NOT `post_date` /
`publish_date` / `scheduled_at`. Substack rejects the request with
`{"errors":[{"param":"trigger_at","msg":"Invalid value"}]}` if you use the
wrong name — that error is also how I found the right one.

**`post_audience`** accepts: `everyone` (verified). Other values likely
mirror the audience options in the publish UI (`subscribers_only`,
`paid_subscribers_only`).

### ✅ `GET /api/v1/drafts/{id}/scheduled_release`
**Host:** `{subdomain}.substack.com`
**Returns:** Array — `[]` if not scheduled, or
`[{ trigger_at, post_audience, email_audience }]` when active.

### ✅ `DELETE /api/v1/drafts/{id}/scheduled_release`
**Host:** `{subdomain}.substack.com`
**Returns:** Array of cancelled schedule IDs. Unschedules the draft.

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

### ✅ `GET /api/v1/post_management/scheduled`
**Host:** `{subdomain}.substack.com`
**Required query:** `offset`, `limit`, `order_by=draft_updated_at`,
`order_direction=desc`.
**Important:** Unlike `/published`, `order_by` only accepts `draft_updated_at`
(NOT `post_date`). Returns same `{posts, offset, limit, total, isCapped}` shape.

### ✅ `GET /api/v1/posts/by-id/{post_id}`
**Host:** `{subdomain}.substack.com` (use the pub's actual host — custom
domain or `{sub}.substack.com`)
**Returns:** `{ post: {...} }` — single post with full content. Works for
public + auth'd-subscriber posts.

### ❌ `GET /api/v1/posts/{slug}` (DOES NOT EXIST)
The slug-based lookup variant 404s. Use `/posts/by-id/{post_id}` instead;
post IDs are returned in every list endpoint.

---

## Notes (Substack's micro-blogging surface)

Substack treats Notes as a kind of "comment" internally — the endpoint
names use `comment` even though the UI calls them Notes.

### ✅ `POST /api/v1/comment/feed`
**Host:** `substack.com`
**Body:**
```json
{
  "bodyJson": {
    "type": "doc",
    "attrs": { "schemaVersion": "v1", "title": null },
    "content": [
      { "type": "paragraph", "content": [{ "type": "text", "text": "Hello." }] }
    ]
  },
  "replyMinimumRole": "everyone"
}
```
**Returns:** Created comment object with `id`. Use the id to delete.
**Important:** `bodyJson` is a **ProseMirror document tree**, not plain text or
HTML. The simplest valid shape is a `doc` containing one `paragraph` with one
`text` node. For richer notes (links, mentions, images), inspect the
ProseMirror schema by capturing a complex Note via DevTools.

### ✅ `GET /api/v1/feed/drafts?limit=N`
**Host:** `{subdomain}.substack.com`
**Returns:** `{ drafts: [], hasMore: boolean, nextCursor: string|null }` —
list of saved Notes drafts for the publication.

### ✅ `GET /api/v1/reader/feed/profile/{user_id}`
**Host:** `substack.com`
**Returns:** `{ items: [...] }` — the user's published Notes (and other
profile activity) in chronological order. Each item has `entity_key`
(`c-{comment_id}` for notes, `p-{post_id}` for posts), `type`, `context`
(timestamp + nested data), `users`.

### ✅ `GET /api/v1/reader/feed?limit=N`
**Host:** `substack.com`
**Returns:** `{ items: [...] }` — the cookie holder's personalized Notes
home feed. Same item shape as `/reader/feed/profile/{user_id}` —
`entity_key` prefixes are `c-{id}` for notes/comments, `p-{id}` for posts.

### ✅ `GET /api/v1/feed/following`
**Host:** `substack.com`
**Returns:** `[user_id_1, user_id_2, ...]` — flat JSON array of user IDs
the cookie holder follows. The first entry is always the user's own id.
**Note:** Despite the `/feed` prefix, this is NOT a content feed — it's
the **following list**. Sibling `/feed/{name}` paths (`foryou`, `home`,
`top`, `notes`, `recommended`, `trending`, etc.) all 404.

### ✅ `POST /api/v1/reader/feed/{entity_key}/seen`
**Host:** `substack.com`
**Body:** empty (`-d ''` or no body). The Cloudflare-friendly
`Content-Length: 0` header is fine.
**Use:** Mark a feed item as seen (the web client fires this on view for
analytics). Mostly useful for clients that want to mirror the web's
read-tracking behavior.

### ✅ `DELETE /api/v1/comment/{comment_id}`
**Host:** `substack.com`
**Returns:** `200 {}` on success. The `{comment_id}` is the numeric id
(without the `c-` prefix from `entity_key`). Works on Notes you authored.

### ❌ `GET /api/v1/comment/feed`
Returns 403 even with valid cookie. The read path for Notes is
`/api/v1/reader/feed/profile/{user_id}`, NOT this. The `comment/feed`
endpoint is POST-only.

---

## Subscribers

### ✅ `POST /api/v1/subscriber-stats`
**Host:** `{subdomain}.substack.com`
**Body:**
```json
{
  "filters": { "order_by_desc_nulls_last": "subscription_created_at" },
  "limit": 50,
  "offset": 0
}
```
**Returns:**
```json
{
  "count": 78,
  "subscribers": [
    {
      "user_id": 305187638,
      "user_email_address": "...",
      "user_name": "...",
      "user_photo_url": null,
      "subscription_id": 1358293107,
      "subscription_created_at": "2026-06-04T19:51:29.324Z",
      "subscription_interval": "free",   // free / monthly / annual
      "subscription_type": null,
      "is_subscribed": false,
      "is_founding": false,
      "is_free_trial": false,
      "is_gift": false,
      "is_comp": false,
      "is_bitcoin": false,
      "activity_rating": 1,
      "total_revenue_generated": 0,
      "total_count": 78
    }
  ],
  "pendingImports": [],
  "pendingCRMImportsCount": 0,
  "order": { "by": "subscription_created_at", "direction": "desc" },
  "chartCounts": {
    "created_at": "2022-11-15T14:06:31.157Z",
    "subscribers": 0,
    "lifetime_subscribers": 0,
    // ... daily snapshots
  },
  "batchSubscriberActions": [],
  "lastSync": "2026-06-23T05:35:09.172Z"
}
```

**Important:** This is a **POST**, not a GET. Body's `filters` object supports
sort variants; `limit`/`offset` for pagination. `count` is the total subscriber
count — useful even when you only need the number.

**Why a POST for a read?** Substack uses POST for endpoints that take rich
filter objects in the body. Same pattern as other "search with filters"
endpoints in the surface.

---

## Stats & analytics

### ✅ `GET /api/v1/publish-dashboard/summary`
**Host:** `{subdomain}.substack.com`
**Returns:** All-time publication stats.
```json
{
  "subscribers": 1234,
  "appSubscribers": 87,
  "appSubscribersLast30Days": 12,
  "totalEmail": 45000,
  "openRate": 32.4,
  "pledgesAmount": 0,
  "numPledges": 0,
  "pledgeCurrency": "usd",
  "isBestseller": false
}
```
Includes **open rate** — the single most useful publication-level metric for
editorial feedback loops.

### ✅ `GET /api/v1/post_management/detail/{post_id}?offset=0&limit=1`
**Host:** `{subdomain}.substack.com`
**Returns:** `{ posts: [<post>], total: 1 }` — the post object with a
nested **`stats`** dict containing the full per-post engagement breakdown.

**`stats` shape (31 fields):**
```js
{
  // delivery
  sent: 77,
  delivered: 74,
  // open metrics
  opens: 84,              // total opens (incl. multiple per user)
  opened: 21,             // unique users who opened
  open_rate: 0.283784,    // opened / delivered
  // click metrics
  clicks: 2,
  clicked: 1,
  click_through_rate: 0.047619,
  engagement_rate: 0.047619,
  // post-level
  views: 113,
  shares: 1,
  signups: 1,
  subscribes: 0,
  // funnel within 1 day of receipt
  signups_within_1_day: 0,
  subscriptions_within_1_day: 0,
  unsubscribes_within_1_day: 0,
  disables_within_1_day: 0,
  // podcast
  downloads: 0,
  downloads_day7: 0,
  downloads_day30: 0,
  downloads_day90: 0,
  podcast_preview_downloads: 0,
  podcast_preview_downloads_day30: 0,
  // video
  video_views: 0,
  video_minutes_watched: 0,
  // breakdowns
  firstWeekDailyStats: [<7 daily snapshots>],
  links: [<clicked-link records>],
  referrers: { /* traffic sources */ },
  comps: { /* gift/comp subscribers */ },
  has_more_links: false,
  // monetization
  estimated_value: 0
}
```

**Why this endpoint exists at `post_management/detail`** instead of
something obvious like `/post/{id}/stats`: Substack's "post detail" admin
page bundles the post object + its stats together. The `offset` and
`limit` params are part of the management list query convention (vestigial
on the single-post detail call). 

This is the **canonical per-post analytics endpoint** — use it for any
engagement-feedback loop. Open rate, click-through rate, and the daily
7-day trend are particularly useful as AI prompt signals.

### ✅ `GET /api/v1/publish-dashboard/summary-v2?range={N}`
**Host:** `{subdomain}.substack.com`
**Query:** `range` accepts integer day counts. Verified: `7`, `30`, `365`.
**Returns:** Start/end snapshot for the window.
```json
{
  "totalSubscribersStart": 1200, "totalSubscribersEnd": 1234,
  "paidSubscribersStart": 45, "paidSubscribersEnd": 47,
  "arrStart": 5400, "arrEnd": 5640,
  "totalViewsStart": 0, "totalViewsEnd": 0,
  "pledgedArrStart": 0, "pledgedArrEnd": 0
}
```
Use to compute deltas: subs added, ARR change, etc. over the window.

---

## Live streams

### ✅ `GET /api/v1/live_streams`
**Host:** `{subdomain}.substack.com`
**Query:** `status` (`scheduled` / `live` / `ended`), `stream_type`
(`rtmp_only` / others)
**Returns:** `{ liveStreams: [...], hasMore: boolean }`. Empty array for
pubs with no live streams.

---

## Publication settings

### ✅ `GET /api/v1/publication/users`
**Host:** `{subdomain}.substack.com`
**Returns:** Users with roles on this publication (admins, editors).

### ✅ `GET /api/v1/publication/post-tag`
**Host:** `{subdomain}.substack.com`
**Returns:** Array of post tags configured for the publication.

### ✅ `POST /api/v1/publication/post-tag`
**Host:** `{subdomain}.substack.com`
**Body:** `{ "name": "..." }` — create a new tag.
**Returns:** `{ id: "<uuid>", publication_id, slug, name, hidden }`. Note that
tag IDs are UUIDs, not integers.

### ✅ `DELETE /api/v1/publication/post-tag/{id}`
**Host:** `{subdomain}.substack.com`
**Returns:** `200 {}` on success.

### ✅ `POST /api/v1/post/{post_id}/tag/{tag_id}`
**Host:** `{subdomain}.substack.com`
**Body:** empty (no JSON body required).
**Returns:**
```json
{
  "id": "<uuid — the post↔tag attachment id>",
  "publication_id": 1193634,
  "post_id": 184700516,
  "post_tag_id": "<the tag uuid>"
}
```
Note: `post_id` is the **integer** post id (from `/post_management/*` or
`/posts/by-id`). `tag_id` is the **uuid** returned by
`POST /publication/post-tag`. They're different types — easy to mix up.

### ✅ `DELETE /api/v1/post/{post_id}/tag/{tag_id}`
**Host:** `{subdomain}.substack.com`
**Returns:** `200 {}` on success. Detaches without deleting the tag itself.

### Tags appear in post objects under `postTags`
When you GET a post via `/posts/by-id/{id}`, attached tags are in a
`postTags` array (not `tags`):
```json
{
  "post": {
    "id": 184700516,
    "postTags": [
      { "id": "<uuid>", "publication_id": 1193634, "name": "...", "slug": "...", "hidden": false }
    ]
  }
}
```

### ✅ `GET /api/v1/publication_launch_checklist`
**Host:** `{subdomain}.substack.com`
**Returns:** Onboarding checklist state (about_page completed, first_post
sent, etc.).

### ✅ `POST /api/v1/image`
**Host:** `{subdomain}.substack.com`
**Body (JSON):** `{ "image": "data:image/png;base64,<base64-encoded-bytes>" }`
**Returns:** `{ id, url, contentType, bytes_required, width, height, ... }`
where `url` is an S3-hosted CDN URL safe to use in drafts/posts.

**Important:** This endpoint takes a **base64 data URI as JSON**, NOT a
multipart upload. Multipart returns 400 `"Invalid value"`. Some older clients
have this wrong.

---

## Categories

### ✅ `GET /api/v1/category/public/{category_id}/{category_type}`
**Host:** `substack.com`
**Returns:** `{ publications: [...] }` — publications in a category.
**`category_type` accepts:** `all`, `top`, `new`. Get category IDs from
`/api/v1/categories`.

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
- ❌ `GET /api/v1/contacts`, `GET /api/v1/subscribers`, `GET /api/v1/free_subscribers` — none of these GET forms exist. Use `POST /api/v1/subscriber-stats` instead.
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

## Open questions (PRs welcome)

These exist as features in the Substack web app but the endpoint paths
haven't been identified. The fastest way to crack each:

1. Open Substack in Chrome, F12 → Network tab, filter to **Fetch/XHR**
2. Perform the action in the UI
3. The matching request appears in Network — right-click → **Copy as cURL**
4. Strip the cookie + headers down to the minimum that still works
5. PR the result here

Currently unsolved (need targeted captures — pattern-guessing exhausted):

- *(SOLVED — `POST /drafts/{id}/scheduled_release` with body
  `{trigger_at, post_audience}`. See "Scheduling" section above.)*
- *(SOLVED — Notes are at `POST /comment/feed` for creating,
  `GET /reader/feed` for the home feed, `GET /reader/feed/profile/{user_id}`
  for a profile, `DELETE /comment/{id}` for deletion. See the "Notes"
  section above.)*
- *(SOLVED — `GET /post_management/detail/{post_id}?offset=0&limit=1`
  returns the post with a nested `stats` dict containing 31 engagement
  fields. See "Stats & analytics" section above.)*
- **Image MULTIPART upload** — JSON+base64 works (`/api/v1/image`); multipart
  to the same path 400s.

### Recently solved (kept as breadcrumbs)
- **Per-post stats** → `GET /post_management/detail/{post_id}` with
  `offset=0&limit=1` (round 8 — captured via publish/posts/detail/{id}).
  The `stats` dict has 31 fields including open_rate, ctr, opens, clicks,
  daily breakdowns, referrers, and unsubscribe metrics. Lives in
  `post_management/` (the admin list namespace) rather than at a
  `/stats` path.
- **Post scheduling** → `POST /drafts/{id}/scheduled_release` with
  `{trigger_at, post_audience}` (round 6 — captured via drafts → Edit →
  Schedule). The field is `trigger_at`, not `post_date` or `publish_date`.
- **Notes API** → `POST /comment/feed` (create), `GET /reader/feed`
  (home), `GET /feed/drafts` (drafts list), `DELETE /comment/{id}`
  (round 5).
- **Subscribers list** → `POST /api/v1/subscriber-stats` (round 4 —
  captured via Substack admin → publish/subscribers). It's a POST with
  filters in the body, which is why every GET probe missed it.
- **Publication-level stats** → `/api/v1/publish-dashboard/summary` and
  `/publish-dashboard/summary-v2?range={N}` (round 3 — captured via
  Substack admin → publish/home dashboard)

## Contributing

Find a new endpoint? Test with curl, then PR with:
- Method + path
- Required host (`substack.com` vs `{sub}.substack.com`)
- Required headers / query params
- Sample response (sanitize user data)
- Classification (✅ / 🟡 / ❓)
- Date you verified it
