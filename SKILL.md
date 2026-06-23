---
name: substack-api
description: Use Substack's unofficial cookie-authenticated API to read posts, create drafts, publish issues, and manage publications on behalf of a logged-in Substack user. Required when the user asks to post to Substack, schedule a Substack send, mirror content to Substack, or extract data from a Substack account.
---

# Substack API Skill

You can drive Substack programmatically using their internal cookie-authenticated
API. There is no public API key program — auth is the session cookie a normal
browser uses.

## When to use this skill

Trigger phrases (not exhaustive):
- "post to Substack" / "send via Substack"
- "create a draft in [my Substack]"
- "publish to {publication}.substack.com"
- "import my Substack subscribers"
- "read my Substack posts"
- "schedule a Substack send"

## Before you do anything

You need TWO pieces of state from the user:

1. **Session cookie** — `connect.sid` value (or `substack.sid` on older
   accounts). See `AUTH.md` for how to obtain.
2. **Publication subdomain** — e.g. `yournewsletter` (NOT the full URL).
   Get this from `/api/v1/user/profile/self` if not supplied.

Always confirm both before making mutating calls. If the user supplied a URL
like `https://yournewsletter.substack.com`, parse out the subdomain.

## Canonical request shape

```
Cookie: connect.sid=<value>; substack.sid=<value>
User-Agent: Mozilla/5.0
```

`Mozilla/5.0` is enough — default Node/Python User-Agents get 403'd.

## The five operations you'll actually do

### 1. Validate a cookie + discover the user's publications

```http
GET https://substack.com/api/v1/user/profile/self
```

Returns `{id, handle, publicationUsers: [{publication: {id, name, subdomain}, role, is_primary}]}`.
- Any 200 = cookie valid
- 401 = cookie expired or wrong
- Pick the publication via subdomain — show user a picker if multiple exist

### 2. Create a draft (no send)

```http
POST https://{subdomain}.substack.com/api/v1/drafts
Content-Type: application/json

{
  "draft_title": "Subject line",
  "draft_subtitle": "Optional preheader",
  "draft_body": "<p>HTML body</p>",
  "type": "newsletter"
}
```

`draft_body` accepts HTML. Substack will normalize. Returns the draft object
with `id` and `slug`.

### 3. Update an existing draft (Replace flow)

```http
PUT https://{subdomain}.substack.com/api/v1/drafts/{id}
Content-Type: application/json

{ "draft_title": "...", "draft_subtitle": "...", "draft_body": "..." }
```

Preserves the draft URL — preferable to delete+recreate when the user
wants to "update" rather than "stack a new draft."

### 4. Publish (send to subscribers)

```http
PUT https://{subdomain}.substack.com/api/v1/drafts/{id}/publish
Content-Type: application/json

{ "send": true, "share_automatically": false }
```

**This sends email immediately.** Confirm with the user before calling. Set
`send: false` to "publish to web only" without emailing.

### 5. Delete a draft

```http
DELETE https://{subdomain}.substack.com/api/v1/drafts/{id}
```

Returns 204. 404 = already gone (fine to ignore).

## Common patterns

### Draft-and-confirm flow

The safest default for AI agents:
1. Create as draft (step 2)
2. Show the user the dashboard URL: `https://{sub}.substack.com/publish/post/{id}`
3. Wait for explicit "send it" confirmation
4. Call publish (step 4)

Never auto-publish without a user confirmation in the same turn.

### Update-or-create

```
if user.existing_draft_id:
    try update_draft(existing_id, ...)   # PUT
    if 404: create_draft(...)             # POST
else:
    create_draft(...)
```

### Publication discovery on first run

If the user hasn't told you which pub, call `/user/profile/self` and:
- Surface every `publicationUsers[]` entry where `role === "admin"` or
  `role === "editor"`
- Default to the one with `is_primary: true` if exactly one
- Otherwise present a picker

## Hard rules

1. **Treat the cookie as a secret.** Never log it, never echo it back to the
   user, never include it in error messages you display.

2. **Never publish without confirmation.** Drafts are reversible (DELETE),
   sent emails are not.

3. **Respect rate limits.** Keep to <1 req/sec sustained. For bulk operations,
   add a 1-second sleep between calls.

4. **Handle the 400/tvOnly trap.** `/api/v1/subscriptions` returns 400 if
   you don't include `?tvOnly=false`. The error body says exactly what's
   missing.

5. **Use the publication subdomain, not substack.com, for draft/post operations.**
   `substack.com/api/v1/drafts` returns 404. The endpoint exists per-pub.

## Error handling

| Status | Action |
|---|---|
| 200/204 | Success |
| 400 | Read response body — usually a missing query param |
| 401 | Tell user: cookie expired, re-grab via extension or DevTools |
| 403 | Tell user: cookie OK but no admin access to this publication |
| 404 (HTML) | Endpoint or pub subdomain wrong — don't retry |
| 429 | Back off 5s, retry once. If second 429, surface to user. |

## Reference docs in this repo

- [`README.md`](README.md) — overview + quick start
- [`AUTH.md`](AUTH.md) — getting the cookie (extension + DevTools paths)
- [`ENDPOINTS.md`](ENDPOINTS.md) — every verified endpoint with samples
- [`examples/`](examples/) — drop-in curl + TypeScript code

## What NOT to do

- ❌ Don't try OAuth — Substack has no public OAuth program
- ❌ Don't try `/api/v1/me` or `/api/v1/account` — both 404
- ❌ Don't bypass the user-agent header — Node's default gets 403'd
- ❌ Don't store cookies in plain config files — use a secrets manager
- ❌ Don't email the user list — that's a sending action; require confirmation
