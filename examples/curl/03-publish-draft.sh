#!/bin/sh
# Publish a draft — sends email to subscribers if send=true. IRREVERSIBLE.
# Usage:
#   COOKIE='s%3A...' SUBDOMAIN='yournewsletter' DRAFT_ID=12345 ./03-publish-draft.sh

set -e
: "${COOKIE:?Set COOKIE env var}"
: "${SUBDOMAIN:?Set SUBDOMAIN env var}"
: "${DRAFT_ID:?Set DRAFT_ID env var}"

echo "⚠️  About to publish draft $DRAFT_ID on $SUBDOMAIN.substack.com"
echo "    This will email subscribers. Press Ctrl-C to cancel, Enter to continue."
read -r _

curl -sS -X PUT \
  -H "Cookie: connect.sid=$COOKIE; substack.sid=$COOKIE" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Content-Type: application/json" \
  -d '{"send": true, "share_automatically": false}' \
  "https://$SUBDOMAIN.substack.com/api/v1/drafts/$DRAFT_ID/publish" \
| jq '{ slug, post_date }'
