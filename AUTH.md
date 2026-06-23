# Authentication

Substack's API uses session cookies, the same ones the web app sets. There's no
OAuth, no API key program, no token-issuance endpoint. You authenticate by
sending the cookie your browser already has.

## The cookie

Substack has used two cookie names across versions:

- **`connect.sid`** — current (Express-style signed session cookie)
- **`substack.sid`** — older accounts; some servers still accept it

When in doubt, send both:

```
Cookie: connect.sid=<value>; substack.sid=<value>
```

The value is URL-encoded by the server (`s%3A...` prefix when encoded =
`s:...` when decoded — Express's signed-cookie format). **Send the value
verbatim as it appears in your browser** — don't decode it yourself.

The cookie is `HttpOnly`, which means page JavaScript (`document.cookie`)
cannot read it. Use DevTools' Application tab or a browser extension with the
`cookies` permission to access it.

## Lifetime

- Valid for **months** unless you sign out
- MFA doesn't shorten this — the cookie persists across MFA
- Signing out invalidates immediately
- Substack may rotate on suspicious activity (rare)

## How to get the cookie

### Option A: Browser extension (one click)

The simplest path. Any extension with `cookies` + `host_permissions:
*.substack.com` can read the cookie. A 50-line reference implementation
lives at:

→ [github.com/AnthonyDavidAdams/digest/.../substack-cookie-grabber](https://github.com/AnthonyDavidAdams/newsletter-platform/tree/main/public/extensions/substack-cookie-grabber)

```javascript
// popup.js — the only line that matters
const cookie = await chrome.cookies.get({
  url: 'https://substack.com',
  name: 'connect.sid'
});
navigator.clipboard.writeText(cookie.value);
```

Manifest v3 needs:
```json
{
  "permissions": ["cookies", "clipboardWrite"],
  "host_permissions": ["https://*.substack.com/*"]
}
```

### Option B: DevTools (manual)

1. Open `https://substack.com` (signed in) → F12 → **Application** tab
2. Sidebar → **Cookies** → `https://substack.com`
3. Find the `connect.sid` row (or `substack.sid` on older accounts)
4. Copy the **Value** column

### Option C: From a Network request

In any request the browser makes to substack.com:

1. F12 → **Network** tab → click any XHR/Fetch row
2. Look in **Headers** → **Request Headers** → `Cookie`
3. Extract the `connect.sid=...` segment

## Rate limit

No published limit. Observed working: **<1 req/sec** sustained against a single
publication is fine. Above that, you'll start seeing 429s. Burst higher
briefly without issues.

## Security

The cookie grants **full account access**. Anyone holding it can:

- Create / publish / delete drafts
- Read all subscribers
- Change publication settings
- Switch between publications (multi-pub admin)

Treat it like a password:

- Don't commit to git
- Don't paste into chat/Slack
- Rotate by signing out + back in periodically (1-3 months)
- For automated systems, store in a secrets manager and rotate when the
  account is shared across people

## Sending the cookie from server-side code

```typescript
// Node fetch
const res = await fetch('https://substack.com/api/v1/user/profile/self', {
  headers: {
    'Cookie': `connect.sid=${cookie}; substack.sid=${cookie}`,
    'User-Agent': 'Mozilla/5.0',  // Substack 403s default Node UAs
  }
});
```

```python
# requests
import requests
r = requests.get(
  'https://substack.com/api/v1/user/profile/self',
  cookies={'connect.sid': cookie, 'substack.sid': cookie},
  headers={'User-Agent': 'Mozilla/5.0'},
)
```

## Diagnosing auth failures

| Response | Likely cause |
|---|---|
| `200` | Cookie is good |
| `401` / `403` | Cookie expired, revoked, or wrong endpoint expects publication context |
| `404` HTML page | Endpoint doesn't exist (or pub subdomain wrong) |
| `400 {tvOnly}` | Cookie is good — endpoint needs a missing query param |
