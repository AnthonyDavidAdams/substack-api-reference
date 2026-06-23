#!/bin/sh
# Create a draft on a publication you admin.
# Usage:
#   COOKIE='s%3A...' SUBDOMAIN='yournewsletter' ./02-create-draft.sh

set -e
: "${COOKIE:?Set COOKIE env var}"
: "${SUBDOMAIN:?Set SUBDOMAIN env var (e.g. yournewsletter)}"

curl -sS -X POST \
  -H "Cookie: connect.sid=$COOKIE; substack.sid=$COOKIE" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Content-Type: application/json" \
  -d '{
    "draft_title": "Hello from the API",
    "draft_subtitle": "This was created programmatically",
    "draft_body": "<p>Body content goes here.</p>",
    "type": "newsletter"
  }' \
  "https://$SUBDOMAIN.substack.com/api/v1/drafts" \
| jq '{ id, slug, draft_title }'
