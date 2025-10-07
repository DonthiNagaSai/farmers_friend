How to configure SendGrid event webhooks for local testing

1) In the SendGrid dashboard, go to Settings -> Mail Settings -> Event Webhook.
2) Add your webhook URL (example: https://your-host.example.com/api/sendgrid/events).
   - For local development you can use a tunnel (ngrok/localtunnel) to expose your local server.
3) Select events you care about: delivered, bounce, dropped, deferred, spam_report, etc.
4) Optionally enable signed webhooks and configure verification in the server.

Where events are stored locally
- Events posted to /api/sendgrid/events are appended to `server/data/sendgrid_events.json` with `receivedAt` timestamps.

Notes
- In production you should validate SendGrid's signature and secure this endpoint.
- The server currently accepts and persists events but does not auto-link them to pending users; you can correlate by recipient/email and timestamps.
