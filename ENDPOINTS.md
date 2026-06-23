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

### ✅ `GET /api/v1/user/{user_id}-{handle}/public_profile/self`
**Host:** `substack.com`
**Returns:** Your public profile data — the read-side companion to whatever
the writer's profile page shows. Path is the **slug form**:
`{numeric_user_id}-{handle}`, e.g. `/api/v1/user/12012312-anthonydavidadams/public_profile/self`.

### ✅ `GET /api/v1/blocks/ids`
**Host:** `substack.com`
**Returns:** Flat array of `user_id`s the cookie holder has blocked.

### ✅ `GET /api/v1/activity/unread`
**Host:** `substack.com` or `{subdomain}.substack.com`
**Returns:** `{ count, max, lastViewedAt }`. The activity feed unread-count.
`max` is a boolean — when true the count is capped (display "99+" instead of
the exact number).

### ✅ `GET /api/v1/realtime/token`
**Host:** `substack.com` or `{subdomain}.substack.com`
**Returns:** `{ token: "<JWT>" }`. The JWT (`aud: zync`, includes a permissions
array and short TTL ~1h) authenticates websocket subscriptions to Substack's
realtime service for things like Notes refresh + chat. The token is signed
with Substack's prod issuer key. The web app refreshes it about every 60s.

---

## Auth & login

### ✅ `POST /api/v1/login`
**Host:** `substack.com`
**Body:** `{ email, password }`. Legacy email+password login path. Returns 400
with `errors: [{param: "email"|"password"}]` when fields are missing.

### ✅ `POST /api/v1/email-login`
**Host:** `substack.com`
**Body:** `{ email }`. Sends a magic-link email. Returns 400 with
`errors: [{param: "email"}]` when missing. This is the modern passwordless
login flow.

### ❓ Magic-link verify endpoint
The link in the email points to `https://substack.com/sign-in?token=<jwt>`,
which appears to be handled by a server-side route rather than `/api/v1/*`.
The session cookie is set by that handler. Not currently mapped.

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

### ✅ `GET /api/v1/post_management/drafts`
**Host:** `{subdomain}.substack.com`
**Required query:** `offset`, `limit`, `order_by`, `order_direction`.
`order_by` accepts `draft_updated_at`. Returns the standard
`{posts, offset, limit, total, isCapped}` shape — but the items are drafts,
not published posts. Use as a paginated drafts list (alternative to
`GET /drafts?limit=N` which doesn't paginate cleanly).

### ✅ `GET /api/v1/post_management/counts`
**Host:** `{subdomain}.substack.com`
**Returns:**
```json
{
  "published": 40, "publishedIsCapped": false,
  "drafts": 16,    "draftsIsCapped": false,
  "scheduled": 0,  "scheduledIsCapped": false
}
```
Single-call dashboard counts. Useful for "where do I have work" probes
without hitting each of `/published`, `/drafts`, `/scheduled` separately.

### ✅ `GET /api/v1/post_management/live_stream_drafts`
**Host:** `{subdomain}.substack.com`
**Returns:** Same shape as other `post_management/*` list endpoints. Drafts
that are live-stream drafts specifically.

### ✅ `GET /api/v1/post_management/scheduled`
**Host:** `{subdomain}.substack.com`
**Required query:** `offset`, `limit`, `order_by=draft_updated_at`,
`order_direction=desc`.
**Important:** Unlike `/published`, `order_by` only accepts `draft_updated_at`
(NOT `post_date`). Returns same `{posts, offset, limit, total, isCapped}` shape.

### ✅ `GET /api/v1/post/{post_id}/theme`
**Host:** `{subdomain}.substack.com`
**Returns:** The post-level theme override (per-post styling). Empty/null
when the post uses the publication default. Used by the editor to
restore custom per-post styling.

### ✅ `GET /api/v1/video/linkedin/{post_id}/auto-upload-state`
**Host:** `{subdomain}.substack.com`
**Returns:** LinkedIn auto-cross-post state for the given post (queued,
uploading, uploaded, error). Sibling of the YouTube authorization
endpoints in the Cross-posting section.

### ✅ `PUT /api/v1/user/writer_referrals/code`
**Host:** `{subdomain}.substack.com`
**Returns:** The writer's referral code object. Idempotent — calling
it creates a code on first invocation, returns the existing one
thereafter. Used by the post editor on first load to make sure a
referral code exists before rendering referral UI.

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

### ✅ `POST /api/v1/subscriber/add`
**Host:** `{subdomain}.substack.com`
**Body:** Empty body returns `{}` (200) — endpoint exists and accepts the
call but the no-op suggests it silently ignores empty input. The web UI's
"Add subscriber" form sends `{ email, name? }`. Use with care: this adds a
real subscriber to your publication.

### ✅ `DELETE /api/v1/subscriber/{subscription_id}`
**Host:** `{subdomain}.substack.com`
**Returns:** `400 { error: "Subscription not found" }` for an unknown id,
which confirms the path exists. `subscription_id` is the `subscription_id`
field from `POST /subscriber-stats`. Removes a subscriber from the
publication.

### ✅ `GET /api/v1/import`
**Host:** `{subdomain}.substack.com`
**Returns:**
```json
{
  "total": 0,
  "is_added": 0,
  "is_skipped": 0,
  "is_limited": 0,
  "passImportVerification": true
}
```
Subscriber-import job status (CSV uploads from the UI). `passImportVerification`
gates whether you can run another import — Substack throttles new pubs.

### ✅ `GET /api/v1/subscriptions/page_v2`
**Host:** `substack.com` or `{subdomain}.substack.com`
**Returns:** Paginated `/api/v1/subscriptions` data (publications the user
is subscribed to). Use the `_v2` form for new code — the non-versioned
endpoint is still around but the web app has moved on.

---

## Inbox & reader feed

The "Inbox" is the reader's home — posts from publications they subscribe
to, sorted reverse-chronologically. The "Reader feed" is the Notes home
(For You / Subscribed / etc. tabs).

### ✅ `GET /api/v1/inbox/top`
**Host:** `substack.com`
**Query (verified from web capture):** `inboxType=inbox`, `surface=inbox_all`,
`limit=20`. Other `surface` values likely mirror the inbox filter tabs
(`inbox_listen`, `inbox_paid`, `inbox_saved`, `inbox_history`).
**Returns:** `{ posts: [...] }` — the user's inbox: posts from subscribed
publications. Each post item has full post shape (id, title, slug,
publication_id, etc.).

### ✅ `POST /api/v1/inbox/seen`
**Host:** `substack.com`
**Body:** empty.
**Returns:** `{ ok: true }`. Marks all inbox items as seen.

### ✅ `GET /api/v1/reader/feed/tabs`
**Host:** `substack.com`
**Returns:**
```json
{
  "tabs": [
    { "id": "for-you",    "name": "For you",   "type": "base",      "layout": "post_queue_head",      "trackingParameters": {...} },
    { "id": "subscribed", "name": "Following", "type": "secondary", "layout": "...", ... },
    ...
  ]
}
```
The list of tabs in the Notes home feed. `layout` controls the rendering
style of items in that tab.

### ✅ `GET /api/v1/reader/feed/c-{comment_id}` and `/p-{post_id}`
**Host:** `substack.com`
The `entity_key` prefix (`c-` for notes/comments, `p-` for posts) routes
to the right item shape. Used by the SPA when expanding a single feed
item into a detail view.

### ✅ `POST /api/v1/reader/feed/{entity_key}/seen`
*(Already documented in Notes section above — same shape; works for any
feed item entity_key.)*

---

## Search

### ✅ `GET /api/v1/search/explore/web?query=...`
**Host:** `substack.com`
**Returns:** Global search results across publications, posts, and Notes.

### ✅ `GET /api/v1/search-modules`
**Host:** `substack.com`
**Returns:** `{ modules: [...] }` — content modules to populate the
search-page surface before the user types anything: trending topics
(`type: "trending_topics"` with `suggestedSearches`), trending posts per
category (`type: "trending", name: "Business" | "Tech" | ...`), etc.
Useful for clients that want to build a discovery surface.

---

## Notifications & moderation

### ✅ `GET /api/v1/notification_settings/post/{post_id}/mute`
**Host:** `{subdomain}.substack.com`
**Returns:** Mute state for a specific post — whether the cookie holder
has muted notifications for replies/reactions on that post. Per-post,
not per-publication.

### ✅ `GET /api/v1/comment/moderation/delete_reasons`
**Host:** `substack.com`
**Returns:**
```json
{
  "reasons": [
    { "id": "violated_reply_rules", "label": "Violated reply rules" },
    { "id": "slop",                 "label": "Slop" },
    { "id": "clickbait",            "label": "Clickbait" },
    { "id": "spam",                 "label": "Spam" },
    { "id": "shilling",             "label": "Shilling" },
    { "id": "political",            "label": "..." },
    ...
  ]
}
```
The enum of moderator-delete reasons. Use when calling the (not yet
mapped) `POST /comment/moderation/delete` endpoint, which the writer
admin UI fires when removing a reader comment.

### ✅ `GET /api/v1/threads/reactions`
**Host:** `substack.com`
**Returns:**
```json
{
  "suggestedReactionTypes": ["thumbs_up", "upvote", "face_with_tears_of_joy", "double_exclamation_mark"],
  "categories": [
    { "title": "Frequently used", "reactionTypes": ["broken_heart", "thinking_face", ...] },
    ...
  ]
}
```
Catalog of reaction emojis available on Notes/comments. The reaction
**name** strings (e.g. `thumbs_up`) are used as the payload when posting
a reaction (POST endpoint not yet mapped).

---

## Subscriptions (reader-side, account-scoped)

These are subscriptions the cookie holder has TO other publications
(different from `POST /subscriber-stats` which lists subscribers OF a
publication you own).

### ✅ `GET /api/v1/subscriptions/page_v2`
**Host:** `substack.com` or `{subdomain}.substack.com`
**Returns:**
```json
{
  "subscriptions": [
    {
      "id": 215478136,
      "user_id": 12012312,
      "publication_id": 1,
      "expiry": null,
      "bundle_id": null,
      "email_disabled": true,
      "membership_state": "free_signup",
      "type": null,
      ...
    }
  ]
}
```
Paginated list of the user's subscriptions. `membership_state` values
include `free_signup`, `subscribed`, etc.

### ✅ `GET /api/v1/subscriptions/top/v2`
**Host:** `substack.com`
**Returns:** `{ items: [{ id, pub: {author_id, author_name, ...}, ... }] }` —
the user's "top" (most-engaged-with) subscriptions, used for discovery
surfaces in the Substack app.

### ✅ `GET /api/v1/subscription`
**Host:** `{subdomain}.substack.com`
**Returns:** The cookie holder's subscription to **this specific pub**
(if any). Useful for "am I subscribed to X?" checks without iterating
the full subscriptions list.

### ✅ `GET /api/v1/archive`
**Host:** `{subdomain}.substack.com`
**Returns:** The publication's archive — all published posts,
typically used to render the `/archive` reader page. Same data is
available via `/posts?limit=N` with pagination — `/archive` is the
unpaginated full-list variant.

---

## Reader comments (on posts)

Reader comments are distinct from Notes despite both using the `/comment`
namespace. These are the comments that appear under a published post.

### ✅ `GET /api/v1/post/{post_id}/comments`
**Host:** `{subdomain}.substack.com`
**Returns:**
```json
{
  "comments": [
    {
      "id": 281390316,
      "user_id": 12012312,
      "body": "...",
      "body_json": { /* ProseMirror tree */ },
      ...
    }
  ],
  "automod_hidden_comments": []
}
```
Use the `post_id` integer (not slug). Comments authored by users who got
auto-flagged appear under `automod_hidden_comments`.

### ✅ `POST /api/v1/post/{post_id}/comment`
**Host:** `{subdomain}.substack.com`
**Body:** `{ "body": "comment text" }` — minimum required.
**Returns:** The created comment with `id`, `user_id`, `body`, `body_json`
(parsed ProseMirror tree). Substack auto-converts plain `body` text into
the canonical ProseMirror shape.

Empty body returns `400 { error: "Please type in a comment" }`.

### ✅ `DELETE /api/v1/comment/{comment_id}`
**Host:** `{subdomain}.substack.com` works too (not just `substack.com` —
the Notes section already documented this path on the account host).
**Returns:** `200 {}` on success. Same endpoint deletes both reader
comments and Notes.

---

## Recommendations (cross-publication promotion)

The "Recommendations" feature lets publications recommend each other to
their subscribers. Important: these endpoints **403 from a plain curl
session** but **200 from a real browser session**, even with the same
cookie. The difference appears to be either a header sent by the SPA or
referer-based gating. If you need to hit them headlessly, send full
browser-style headers including `Sec-Fetch-*`, `Referer`, `Origin`.

### ✅ `PUT /api/v1/recommendations`
**Host:** `{subdomain}.substack.com`
**Body:**
```json
{
  "recommended_publication_id": 7928971,
  "recommending_publication_id": 1193634,
  "source": "recommendation-stats",
  "suggested": false
}
```
**Fields:**
- `recommended_publication_id` — the pub being recommended
- `recommending_publication_id` — the pub doing the recommending
- `source` — string tracking the click origin. Observed values:
  `recommendation-stats` (clicked from the dashboard's suggestions).
  Likely also `manual-search`, `suggested-modal`, etc.
- `suggested` — boolean, whether the rec came from Substack's suggested
  list (vs. manual search)

**Returns:** `200` on success. The endpoint is **idempotent** — recommending
the same pub twice is a no-op (matches the `recommendations/from/{from}/to/{to}`
existence-check pattern).

### ✅ `DELETE /api/v1/recommendations/`
**Host:** `{subdomain}.substack.com` — **note the trailing slash** in the
path (`/recommendations/` not `/recommendations`).
**Body:**
```json
{
  "recommended_publication_id": 7928971,
  "recommending_publication_id": 1193634,
  "source": "recommendation-stats"
}
```
Same fields as `PUT` minus `suggested`. Removes an outgoing recommendation.

### ✅ `GET /api/v1/recommendations/from/{publication_id}`
**Host:** `{subdomain}.substack.com` (the recommending pub's host)
**Optional query:** `offset`, `limit`, `paginate=true` (the web UI passes
`offset=0&limit=50&paginate=true`).
**Returns:** `[ <recommendation> ]` array. Empty `[]` if no recommendations
set. `publication_id` is the recommender's id (from `/user/profile/self`
or `/publication`).

### ✅ `GET /api/v1/recommendations/exist`
**Host:** `{subdomain}.substack.com`
**Returns:** Cheap "do recommendations exist for this pub?" probe — used
by the SPA to decide whether to show the recommendations UI.

### ✅ `GET /api/v1/recommendations/{publication_id}/suggested`
**Host:** `{subdomain}.substack.com`
**Returns:** ML-suggested publications to recommend, based on overlap
with the pub's subscribers. Used to populate the "Add recommendation"
modal.

### ✅ `GET /api/v1/recommendations/from/{from_pub_id}/to/{to_pub_id}`
**Host:** `{from_pub_id}.substack.com`
**Returns:** Existence + metadata for a specific recommendation edge.
Used by the "Add recommendation" modal to gate the Add button (so you
can't double-add).

### ✅ `GET /api/v1/recommendations/stats/to`
**Host:** `{subdomain}.substack.com`
**Required query:** `offset`, `limit`, `order_by` (e.g. `xp_signups`),
`order_direction` (`desc`/`asc`).
**Returns:** Incoming recommendations TO this pub with subscriber-acquisition
stats. Used for the "Incoming recommendations" table in the dashboard
("Substack X sent you Y subs from their recommendation").

### ✅ `GET /api/v1/publication/search`
**Host:** `{subdomain}.substack.com`
**Required query:** `query` (search string), `page` (zero-indexed).
**Returns:** Paginated list of publication objects matching the search.
Used by the "Add recommendation" search box. Each result has at minimum
`id`, `name`, `subdomain`, `logo_url`, `custom_domain`.

### 🔒 `GET /api/v1/publication/recommendations`
**Host:** `substack.com`
**Returns:** 403 from curl, observed in browser captures. Likely the
"recommendations involving you" cross-cut view.

### ❓ Add / remove a recommendation
The web UI's "Add recommendation" → publication-typeahead → submit
fires a `POST` we haven't captured yet. Likely shape:
`POST /recommendations` with `{ publication_id, note? }`. PR welcome.

---

## Messages & DMs

Substack has writer-to-writer DMs (separate from Notes and from publication
chat).

### ✅ `GET /api/v1/messages/inbox`
**Host:** `substack.com`
**Returns:** Inbox of DMs.

### ✅ `GET /api/v1/messages/unread-count`
**Host:** `substack.com` or `{subdomain}.substack.com`
**Returns:**
```json
{
  "unreadCount": 0,
  "pendingInviteCount": 0,
  "pendingInviteUnreadCount": 0,
  "newPendingInviteUnreadCount": 0,
  "pubChatUnreadCount": 0
}
```
Combined badge counts: DMs (`unreadCount`), pending DM-invites
(`pendingInvite*`), and publication chat (`pubChatUnreadCount`).

### ❓ Sending a DM
Not yet mapped. Likely `POST /messages` with `{recipient_user_id, body}`.

---

## Paid subscriptions & Stripe

### ✅ `GET /api/v1/stripe/account`
**Host:** `{subdomain}.substack.com`
**Returns:** `{ account, plans }`. Both `null` when Stripe isn't connected
yet. When connected, returns Stripe Connect account info and any configured
plans.

### ✅ `GET /api/v1/pledges/plans`
**Host:** `{subdomain}.substack.com`
**Returns:**
```json
{
  "enabled": true,
  "payment_pledge_plans": [
    { "name": "Yearly",   "amount": 5000, "interval": "year",  "currency": "usd" },
    { "name": "Monthly",  "amount": 500,  "interval": "month", "currency": "usd" },
    { "name": "Founding", "amount": ..., ... }
  ]
}
```
The publication's configured pledge/subscription tier list. Amounts are
in cents. `enabled` indicates the pub has paid subscriptions configured
(even if Stripe isn't fully connected).

### ✅ `GET /api/v1/pledges/plans/summary`
**Host:** `{subdomain}.substack.com`
**Returns:** Summary stats for the pledge plans.

---

## Cross-posting (YouTube, LinkedIn)

Substack supports cross-posting video to YouTube and LinkedIn.

### ✅ `GET /api/v1/video/youtube/check-authorization`
**Host:** `{subdomain}.substack.com`
**Returns:** Auth status for YouTube cross-post. Whether the writer has
linked a YouTube channel.

### ✅ `GET /api/v1/video/youtube/show-banner`
**Host:** `{subdomain}.substack.com`
**Returns:** Whether to show the "connect YouTube" banner in the editor.

### ✅ `GET /api/v1/video/linkedin/check-authorization`
**Host:** `{subdomain}.substack.com`
**Returns:** Auth status for LinkedIn cross-post.

---

## Growth helpers

### ✅ `GET /api/v1/grow/suggestion`
**Host:** `{subdomain}.substack.com`
**Returns:**
```json
{
  "suggestion": {
    "header": "Engage in comments",
    "body": "...",
    ...
  }
}
```
Server-side "grow your publication" tips. Rotates over time. Used to
populate the dashboard's growth card.

---

## Telemetry

### ✅ `POST /api/v1/firehose/batch`
**Host:** `{subdomain}.substack.com`
**Returns:** `204` (no body). Substack's client-side analytics batch
endpoint. The web app fires this constantly with page-view and interaction
events. Documenting only so people who notice it in their captures
understand what it is. **Not useful for clients** — don't call it
manually.

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

### ✅ `GET /api/v1/publication/stats/emails/timeseries`
**Host:** `{subdomain}.substack.com`
**Returns:** Array of `[date_string, count]` pairs, one per day going back
~1 year. The `count` is daily email sends. Useful for plotting send volume.
```json
[["2025/06/24", 72], ["2025/06/25", 72], ["2025/06/26", 71], ...]
```

### ✅ `GET /api/v1/publication/stats/network_attribution`
**Host:** `{subdomain}.substack.com`
**Returns:**
```json
{
  "rows": [
    {
      "publication_id": 1193634,
      "time_window": "90 days",
      "is_subscribed": false,
      "criteria": 3,
      "label": "Substack existing accounts",
      "subs_count": 1,
      "pct_time_window_total": 1,
      "data_updated_at": "..."
    }
  ]
}
```
Subscriber attribution by source — how many came from each channel
("Substack existing accounts", "Notes", "Direct", etc.) over a time window.

### ✅ `GET /api/v1/publication/stats/payment_pledges`
**Host:** `{subdomain}.substack.com`
**Returns:** `{ pledgeAndUserData: [...], summary: { count, hasMore } }`.
Per-user paid-pledge breakdown.

### ✅ `GET /api/v1/publication/stats/can-delete-archive`
**Host:** `{subdomain}.substack.com`
**Returns:** Permission flag for deleting archived stats. Admin-only.

### ✅ `GET /api/v1/publication/stats/growth/sources`
**Host:** `{subdomain}.substack.com`
**Required query:** `from_date=YYYY-MM-DD`, `to_date=YYYY-MM-DD`,
`order_by` (e.g. `users`), `order_direction` (`desc`/`asc`).
**Returns:** Subscriber/visitor source breakdown for the date window —
the "Growth sources" table in the writer dashboard. Used to attribute
new subs to channels (Notes, recommendations, direct, etc.).

### ✅ `GET /api/v1/publication/stats/growth/events`
**Host:** `{subdomain}.substack.com`
**Required query:** `from_date=YYYY-MM-DD`, `to_date=YYYY-MM-DD`.
**Returns:** Growth events timeline — discrete events that drove
subscriber inflow (new post sent, viral note, recommendation switched on,
etc.). Used to annotate the growth chart.

### ✅ `POST /api/v1/publication/stats/growth/partial-timeseries`
**Host:** `{subdomain}.substack.com`
**Returns:** Partial chart series updates. The web app fires this when
the user pans/zooms the growth chart. Body shape not yet enumerated;
probably `{from_date, to_date, granularity, metric}`. PR welcome.

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

### ✅ `GET /api/v1/live_stream/eligible_hosts`
**Host:** `{subdomain}.substack.com`
**Returns:** `{ users: [{ id, name, handle }] }`. Users who can host a
live stream for this publication (admins/editors).

---

## Publication settings

### ✅ `GET /api/v1/publication`
**Host:** `{subdomain}.substack.com` — important: this 403s from
`substack.com` but **200s from the pub subdomain**.
**Returns:** The full publication object:
```json
{
  "id": 1193634,
  "subdomain": "anthonydavidadams",
  "is_personal_mode": false,
  "name": "The Impossible Path",
  "custom_domain": null,
  "logo_url": "https://substackcdn.com/...",
  ...
}
```
Use as the read-side companion to `PUT /publication` (settings update).

### ✅ `PUT /api/v1/publication`
**Host:** `{subdomain}.substack.com`
**Body:** A single-field partial publication object. The web UI saves
**one field per call** — clicking "Save" on a specific field sends only
that field, not the whole object.
```json
{ "hero_text": "Notes on life, love & leadership." }
```
**Confirmed writable fields** (captured by patching `window.fetch` in the
settings UI and toggling fields):
- `name` — string (publication name)
- `hero_text` — string (publication short description)
- `language` — string (ISO 639-1 code; `en`, `es`, etc. — Substack
  reloads the UI immediately to render in the new language)

With empty body returns `{"error":"No valid publication parameters provided"}`.

Other fields likely accepted (from the `GET /publication` response shape):
`logo_url`, `custom_domain`, `is_personal_mode`, and several theme/color
fields. PRs welcome to upgrade these to ✅ Confirmed.

### ✅ `GET /api/v1/publication_settings`
**Host:** `{subdomain}.substack.com`
**Returns:** The publication's settings — a flat key/value map of boolean
toggles and a few non-boolean values. Separate from the publication
object itself (which holds name/logo/etc.).

### ✅ `PUT /api/v1/publication_settings`
**Host:** `{subdomain}.substack.com`
**Body:** Single-field partial settings object. The web UI fires this
the moment you toggle a switch.
```json
{ "high_res_recording_beta": true }
```
**Confirmed writable fields:**
- `high_res_recording_beta` — boolean (live-video high-resolution toggle)

Many other toggles exist in the settings UI: subscribe prompts on post
page, enable auto-clips, archive nav visibility, about-page visibility,
notes-tab visibility, email-confirmation requirement, comments/likes/
restacks toggle, automatic moderation, restack visibility, subscriber
chat, live video replays, private mode, allow cross-posting, allow
listing on Substack.com, AI training opt-out, hide stats, show
approximate subscriber count. Each fires `PUT /publication_settings`
with `{field: bool}`. Field names match the form field names — visible
in the DOM if you inspect the toggle's underlying input.

### ✅ `GET /api/v1/publication/verify_status`
**Host:** `{subdomain}.substack.com`
**Returns:** Publication-verification status (Substack's blue-check
equivalent). Fired on the dashboard.

### ✅ `GET /api/v1/publication/logo`
**Host:** `{subdomain}.substack.com`
**Returns:** Logo metadata.

### ✅ `GET /api/v1/publication/bestseller_tier`
**Host:** `{subdomain}.substack.com`
**Returns:** `{ bestseller_tier: null | <tier> }`. The Substack
"Bestseller" badge tier the publication qualifies for (or null).

### ✅ `GET /api/v1/publication/publication_tags`
**Host:** `{subdomain}.substack.com`
**Returns:** Array of category tags the publication has chosen.
```json
[
  { "id": 355, "name": "Health & Wellness", "canonical_name": "Health & Wellness", "active": true, "parent_tag_id": null },
  { "id": 96,  "name": "Culture",           "canonical_name": "culture",            "active": true, "parent_tag_id": null }
]
```
**Note:** These are the **publication-level discovery tags** (think:
categories Substack groups pubs into), distinct from `/publication/post-tag`
which is the per-post tag system.

### ✅ `GET /api/v1/publication/post-tag/settings`
**Host:** `{subdomain}.substack.com`
**Returns:** Same as `/publication/post-tag` but each tag includes a
`navigationBarItem` field — when non-null, the tag appears in the pub's
top navigation bar.

### ✅ `GET /api/v1/publication/subdomain/can_alias`
**Host:** `{subdomain}.substack.com`
**Returns:** `{ can_alias: true | false }`. Whether the pub can be aliased
to a different subdomain (subscription-tier or admin-permission gated).

### ✅ `GET /api/v1/publication/transfer_ownership/status`
**Host:** `{subdomain}.substack.com`
**Returns:** Current state of any in-flight ownership transfer.

### ✅ `GET /api/v1/publication_user`
**Host:** `{subdomain}.substack.com`
**Returns:** `{ pub_users: [{ id, publication_id, user_id, public, public_rank, name, bio, ... }] }`.
The per-user publication roles + bios. Note the underscore in the path
(`publication_user`) — sibling endpoint `/publication/users` (plural,
slash) also exists and gives a slightly different shape.

### ✅ `GET /api/v1/publication_user_invite`
**Host:** `{subdomain}.substack.com`
**Returns:** Array of pending co-author invites. Empty `[]` when none.
**Note:** NOT `/publication/invites` (which 403s).

### ✅ `POST /api/v1/publication/invite`
**Host:** `{subdomain}.substack.com`
**Body:** `{ email, name }` — both required.
**Returns:** Empty `{ email, name }` returns `400` with both fields named
in `errors`. With valid fields, sends a co-author invite to that email.
**⚠️** This sends a real email. Don't probe with a real address you don't
own.

### ✅ `GET /api/v1/publication/sections`
**Host:** `{subdomain}.substack.com`
**Returns:** Array of publication sections (multi-section pubs use these
to split content into topic streams). Empty `[]` for non-sectioned pubs.

### ✅ `GET /api/v1/publication_pages`
**Host:** `{subdomain}.substack.com`
**Returns:** Custom pub pages (about, archive, etc.). Empty `[]` when
none are configured.

### ✅ `GET /api/v1/publication_export`
**Host:** `{subdomain}.substack.com`
**Returns:** Array of subscriber CSV-export jobs (the "Download
subscribers" UI flow creates one). Each entry has the job status + a
download URL when complete.

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

### ✅ `POST /api/v1/publication`  ⚠️ **captcha-gated**
**Host:** `substack.com`
**Body:**
```json
{
  "name": "My Publication",
  "subdomain": "mypublication",
  "hero_text": "A description longer than the minimum length."
}
```
**Required fields** (enumerated by sending progressively-filled bodies and
reading the field-level error messages): `name`, `subdomain`, `hero_text`.
With all three populated and a valid (non-taken) subdomain, Substack
returns:
```json
{ "error": "Please complete the captcha to continue", "type": "single" }
```
**That's the wall.** Publication creation is captcha-gated by design —
not headlessly automatable with cookies alone. The mechanism is also
not a thin client-side toggle: the request includes a captcha-solution
token in the body (likely from hCaptcha or similar), which Substack
verifies server-side.

**For automation:** create your pub once via the web UI, then use the
API for everything thereafter. The captcha is on creation only.

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

## Audio upload (S3 multipart pattern)

The audio insert flow in the post editor reveals a 4-step S3-presigned
multipart upload sequence. Audio is uploaded to S3 directly (not through
Substack), then Substack is told to complete the multipart upload and
transcode. The same path is reused for podcast episodes.

### ✅ `POST /api/v1/audio/upload`
**Host:** `{subdomain}.substack.com`
**Body:** Empty (`{}`) — though the web client may send richer
parameters (file size, content type) for chunking decisions; needs
more testing.
**Returns:** A response containing the `media_upload_id` (UUID) and one
or more S3 pre-signed PUT URLs targeting
`https://substack-video.s3-accelerate.amazonaws.com/video_upload/post/{post_id}/{upload_id}/original?...`.
Yes, audio uploads use the `substack-video` bucket and the `video_upload`
path — that's not a typo, it's a unified media store.

### ✅ `PUT <s3-presigned-url>` (S3, not Substack)
**Host:** `substack-video.s3-accelerate.amazonaws.com`
**Body:** Raw file bytes.
**Returns:** `200` from S3 with an `ETag` header. **Save the ETag** —
you need it for the next step.

### ✅ `POST /api/v1/audio/upload/{upload_id}/transcode`
**Host:** `{subdomain}.substack.com`
**Body:**
```json
{
  "duration": null,
  "multipart_upload_id": "bdohqlFEhD4U2rlPq1Nuero.Lg_LoZoh6Y...",
  "multipart_upload_etags": ["\"7934201b4a7be4e377bca86ae28f0714\""]
}
```
**Fields:**
- `duration` — file duration in seconds. `null` is accepted (Substack
  measures it during transcode).
- `multipart_upload_id` — opaque token from the S3 presigned URL's
  `uploadId` query param. Substack uses this to call S3's
  CompleteMultipartUpload on the writer's behalf.
- `multipart_upload_etags` — array of ETags returned by each S3 part
  upload. ETag values include surrounding quote characters, which must
  be preserved (`"abc..."`).

**Returns:** `200` on success → transcoding starts asynchronously.

### ✅ `GET /api/v1/audio/upload/{upload_id}`
**Host:** `{subdomain}.substack.com`
**Returns:** Upload + transcode status. The web client polls this
until status indicates "ready" or "failed."

**Validation:** Substack rejects very-short audio files (~<1s of real
audio) with a generic "Something went wrong with your audio file upload"
error after the transcode step. Use real-world content (≥1 second of
non-silence) when probing this flow.

---

## Substack Chat (writer chats / threads)

Substack Chat is internally called "threads" (`/publication_threads_settings`,
`threads_v2_enabled`). This is the publication-level chat for subscribers,
distinct from Notes (`/comment/feed`) and from DMs (`/messages/inbox`).

### ✅ `POST /api/v1/publication/{publication_id}/publication_threads_settings`
**Host:** `{subdomain}.substack.com`
**Body:**
```json
{
  "threads_v2_enabled": true,
  "create_thread_minimum_role": "free_subscriber",
  "reader_thread_notifications_enabled": true
}
```
**Fields:**
- `threads_v2_enabled` — master toggle. `true` enables Chat for the pub;
  `false` disables it.
- `create_thread_minimum_role` — who can start a new thread. Verified
  value: `free_subscriber`. The "Who can start conversations?" dropdown
  in the create-chat modal shows "Everyone" as the default — likely
  also `everyone`, `paid_subscriber`, `founding_member`.
- `reader_thread_notifications_enabled` — whether subscribers get push
  notifications for new threads.

**Returns:** `200` on success. Same endpoint enables and disables —
just flip `threads_v2_enabled`. **The publication shows "Start your
subscriber chat" UI when disabled and a thread list when enabled.**

### ❓ Send a thread message
Not yet mapped. The web app likely uses
`POST /api/v1/comment/feed` (the Notes endpoint) with a different
`context` field, or `POST /publication/{pub_id}/threads`. Capture the
"Start a new thread" + send flow to confirm.

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
- 🔒 `GET /api/v1/publication` on **`substack.com`** — but **200 from
  the pub subdomain** (`{sub}.substack.com`). The endpoint is host-specific.
- 🔒 `GET /api/v1/publication/subscriptions` (likely needs Pro plan or higher
  permission tier)
- 🔒 `GET /api/v1/publication/recommendations` from `substack.com` — but
  the equivalent `/recommendations/from/{pub_id}` on the pub host works.

**Two-host trick:** several endpoints are gated on `substack.com` but open
on the pub subdomain (or vice versa). If you get 403 on one host, try the
other before assuming the endpoint is dead.

**Browser-vs-curl gap:** a small number of endpoints (notably the
recommendations one) return 403 from a plain curl but 200 from a real
Chromium session with the same cookie. The difference appears to be
either a header sent by the SPA (`Sec-Fetch-*`, `Referer`, `Origin`) or
referer-based gating. If a "should work" endpoint 403s from curl, try
adding full browser headers, or drive a real Chromium with Playwright /
Puppeteer.

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
- *(SOLVED — Recommendations at `GET /recommendations/from/{publication_id}`
  on the pub host. 403 from raw curl, 200 from a real browser. See
  "Recommendations" above.)*
- *(SOLVED — Reader comments at `GET /post/{id}/comments`,
  `POST /post/{id}/comment` body `{body}`, delete via
  `DELETE /comment/{id}`. See "Reader comments" above.)*
- *(SOLVED — DMs at `GET /messages/inbox` + `/messages/unread-count`.
  Send-DM endpoint still not mapped — capture the "Send" click in the
  DM compose UI.)*
- *(SOLVED — Inbox + reader feed: `GET /inbox/top`, `POST /inbox/seen`,
  `GET /reader/feed/tabs`. See "Inbox & reader feed".)*
- **Image MULTIPART upload** — JSON+base64 works (`/api/v1/image`); multipart
  to the same path 400s.
- **`PUT /publication` writable field allowlist** — endpoint exists,
  empty body returns "No valid publication parameters provided". The
  full field allowlist needs capture from the settings UI (each toggle
  fires a PUT — capture name, logo_url, hero_text, theme, custom CSS,
  welcome email, custom_domain, language, etc.).
- **`POST /api/v1/settings` accepted `settingName` values** — enum of
  settings keys the generic key-value setter accepts. Capture from
  the account-settings page's toggles.
- **`POST /subscriber/add` required body** — endpoint exists, empty
  body returns `{}` (no-op). The web UI's "Add subscriber" form sends
  `{email, name?, tier?}`. Capture from a real "Add subscriber" click.
- **Send DM** — likely `POST /messages` with `{recipient_user_id, body}`.
- **Add / remove recommendation** — likely `POST /recommendations`
  with `{publication_id, note?}`. Capture from the "Add recommendation"
  flow.
- **Reaction post** — `GET /threads/reactions` returns the catalog of
  reaction types. The POST that applies one is not yet mapped.
- **Comment moderation delete** — likely `POST /comment/moderation/delete`
  with a `reason_id` from `/comment/moderation/delete_reasons`.
- **Custom domain setup** — UI flow exists but endpoints not mapped.
- **Welcome email / auto-sequences** — UI exists, endpoints not mapped.
- **Audio / video / podcast upload** — separate from `/image`. Likely
  S3-presigned-URL pattern (request signed URL, PUT bytes to S3,
  notify Substack the asset is ready).
- **Substack Chat (writer chats)** — entirely uncracked. Distinct from
  Notes and from DMs.
- **Mobile push token registration** — not mapped.

### Recently solved (kept as breadcrumbs)
- **Round 13 (Chrome-extension destructive cycles, 2026-06-23)** —
  with explicit user consent, ran add-then-revert cycles on real
  publication actions to capture write-side bodies that couldn't be
  reached by passive observation. Cracked:
  (a) `PUT /recommendations` body and `DELETE /recommendations/` body
  (note the trailing slash); idempotent design.
  (b) The full **audio upload** sequence: `POST /audio/upload` → S3
  presigned PUT to `substack-video.s3-accelerate.amazonaws.com` →
  `POST /audio/upload/{id}/transcode` with multipart_upload_id +
  etags → `GET /audio/upload/{id}` polling for status.
  (c) **Substack Chat** enable/disable via
  `POST /publication/{pub_id}/publication_threads_settings` with
  `threads_v2_enabled`, `create_thread_minimum_role`,
  `reader_thread_notifications_enabled`.
- **Round 12 (Chrome-extension live capture, 2026-06-23)** — drove the
  user's real Chromium via the Claude Code Chrome integration, monkey-
  patched `window.fetch` and `XMLHttpRequest.send` from a `localStorage`-
  backed log (so captures survived page reloads), and toggled real
  settings/fields to read the actual write-side request bodies. Key
  wins: `PUT /publication` body shape (single field per save:
  `{hero_text}`, `{language: "en"}`, `{name}`), discovery of the
  separate `PUT /publication_settings` endpoint for boolean toggles
  (`{high_res_recording_beta: true}`), the full recommendations surface
  (`/recommendations/exist`, `/recommendations/{pub}/suggested`,
  `/recommendations/from/{from}/to/{to}`, `/recommendations/stats/to`),
  publication search (`/publication/search?query=...&page=N`), growth
  analytics (`/publication/stats/growth/{sources,events,partial-timeseries}`),
  editor-side endpoints (`/post/{id}/theme`,
  `/video/linkedin/{post_id}/auto-upload-state`,
  `/user/writer_referrals/code`, `/publication/verify_status`), and the
  full `inbox/top` query-param set.
- **Round 10 + 11 (Playwright capture sweep, 2026-06-23)** — drove a
  headless Chromium with the writer cookie through the admin SPA
  (publish dashboard, settings sub-pages, Notes home, search). Picked
  up 70+ endpoints in two runs, including the previously-403'd
  recommendations endpoint (works in-browser due to header/referer
  gating), the messages/DMs inbox surface, paid-pledge config, Stripe
  account status, per-post mute settings, comment moderation reasons,
  reaction catalog, reader feed tabs, global search modules, and
  publication CSV-export jobs. Capture script lives at
  `/tmp/substack-capture/capture.js`.
- **Round 9 (curl probe sweep, 2026-06-23)** — empirical-error probing
  enumerated required fields by sending intentionally-invalid POSTs.
  Cracked publication creation (captcha-gated, fields
  `{name, subdomain, hero_text}`), magic-link login (`POST /email-login`),
  generic settings setter (`POST /settings`), reader-comment create
  (`POST /post/{id}/comment`), co-author invite (`POST /publication/invite`),
  subscriber add/remove (`POST /subscriber/add`, `DELETE /subscriber/{id}`),
  publication settings update (`PUT /publication`), subscriber import
  status (`GET /import`).
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
