OTP Delivery Testing (local)

This file explains how to configure and run OTP delivery tests locally for the server.

1) Create a .env file

Copy the example and fill in real values for the provider you want to test:

cp .env.example .env
# Then edit .env and set the credentials you want to test (SendGrid, SMTP/Mailtrap, or Twilio)

2) Start the server with the env vars

# from the server folder
export $(cat .env | grep -v '^#' | xargs)
pkill -f "node index.js" || true
# start node in background (DEV_INCLUDE_OTP=true will include delivery diagnostics in responses)
DEV_INCLUDE_OTP=$DEV_INCLUDE_OTP node index.js &

3) Run a signup test

# Email test
curl -sS -X POST -H "Content-Type: application/json" \
  -d '{"email":"you@yourdomain.com","password":"pass123","name":"Test"}' \
  http://localhost:5001/api/signup | jq '.'

# SMS test (phone)
curl -sS -X POST -H "Content-Type: application/json" \
  -d '{"phone":"+1XXXXXXXXXX","password":"pass123","name":"Test"}' \
  http://localhost:5001/api/signup | jq '.'

What to look for
- The JSON response will include a "delivery" object when DEV_INCLUDE_OTP=true. Example:
  "delivery": { "ok": true, "provider": "sendgrid" }
  or
  "delivery": { "ok": false, "provider": "sendgrid", "status": 401, "body": { ... } }
- If "provider":"console" means OTP is only printed to the server console (no real provider configured).

Common fixes
- SendGrid 401: invalid API key
- SendGrid 403 / 400 with suppression info: sender not verified or recipient suppressed
- SMTP auth errors: wrong SMTP_USER/SMTP_PASS
- Twilio errors: invalid credentials or Twilio number not allowed to send to destination

If you paste the delivery object here I can interpret it and recommend exact fixes.
