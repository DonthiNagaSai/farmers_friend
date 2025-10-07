#!/usr/bin/env bash
# Simple helper to run a signup+resend test against the local server
# Usage: ./scripts/test_signup.sh email you@domain.com
#        ./scripts/test_signup.sh phone +11234567890

set -euo pipefail
TYPE=${1:-email}
VAL=${2:-}
if [[ -z "$VAL" ]]; then
  echo "Usage: $0 email you@domain.com  OR  $0 phone +11234567890"
  exit 1
fi

URL="http://localhost:5001/api/signup"
if [[ "$TYPE" == "email" ]]; then
  PAYLOAD=$(jq -n --arg e "$VAL" '{email:$e, password:"pass123", name:"Test"}')
else
  PAYLOAD=$(jq -n --arg p "$VAL" '{phone:$p, password:"pass123", name:"Test"}')
fi

echo "POST $URL -> $PAYLOAD"
RESP=$(curl -sS -X POST -H "Content-Type: application/json" -d "$PAYLOAD" "$URL")
echo "Signup response:\n$RESP" | jq '.' || true

# If signup returned a pending id, try resend
PID=$(echo "$RESP" | jq -r '.pending.id // empty')
PHONE=$(echo "$RESP" | jq -r '.pending.phone // empty')
EMAIL=$(echo "$RESP" | jq -r '.pending.email // empty')

if [[ -n "$PHONE" ]]; then
  echo "Calling resend for phone $PHONE"
  curl -sS -X POST -H "Content-Type: application/json" -d "{\"phone\":\"$PHONE\"}" http://localhost:5001/api/resend-otp | jq '.' || true
elif [[ -n "$EMAIL" ]]; then
  echo "Calling resend for email $EMAIL"
  curl -sS -X POST -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\"}" http://localhost:5001/api/resend-otp | jq '.' || true
else
  echo "No pending contact found in signup response"
fi
