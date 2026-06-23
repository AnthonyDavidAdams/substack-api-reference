#!/bin/sh
# Validate your Substack cookie and list publications you can edit.
# Usage: COOKIE='s%3A...' ./01-validate-cookie.sh

set -e
: "${COOKIE:?Set COOKIE env var (your connect.sid value)}"

curl -sS \
  -H "Cookie: connect.sid=$COOKIE; substack.sid=$COOKIE" \
  -H "User-Agent: Mozilla/5.0" \
  https://substack.com/api/v1/user/profile/self \
| jq '{
    handle,
    name,
    publications: [
      .publicationUsers[]
      | { name: .publication.name, subdomain: .publication.subdomain, role, primary: .is_primary }
    ]
  }'
