# Farmers Friend

A web app that suggests which crops to grow based on soil readings. A farmer enters nitrogen, phosphorus, potassium, pH, moisture and temperature, and the server compares those values against a 20,000-row crop dataset and returns the five closest matching crops. Every analysis is saved to the user's history so they can look back at past results.

It has separate dashboards for four kinds of users: farmers, students, analysts and admins.

## Tech stack

- React 19 and React Router 7 on the frontend (Create React App)
- Node.js and Express 5 on the backend
- bcrypt password hashing, JWT sessions and OTP verification on sign-up
- OTPs go out by email through SendGrid or any SMTP server, or by SMS through Twilio. With none set up, the OTP is printed in the server console
- Users, admins, datasets and history are stored as JSON files on the server

## Features

- Sign up with email or phone, confirmed with a one-time code
- Login for users and admins, with role-based dashboards (farmer, student, analyst)
- Soil analysis form with input validation (for example, temperature has to be between -10 and 60°C) and gauges showing each reading
- Crop recommendations: each dataset row within a set tolerance of the input (±20 for N, P and K, ±0.5 for pH, ±5°C for temperature) is scored by how close it is, and the top 5 unique crops come back
- Saved analysis history and an editable profile for each user
- Admin pages to upload, preview and delete CSV datasets, see pending sign-ups and turn user accounts on or off

## How the recommendation works

The server reads `server/data/uploads/Crop_Dataset.csv` (columns include Nitrogen, Phosphorus, Potassium, Temperature, pH_Value and Crop). For each row it checks whether every reading is within tolerance of the user's input. Matching rows get a score: the sum of each difference divided by its tolerance, so lower means closer. The rows are sorted by score and the first five different crop names are returned.

It also accepts the column names used by the common Kaggle crop recommendation dataset (N, P, K, ph, label), so other CSVs can be uploaded through the admin page.

## Running it locally

You need Node.js 18 or newer.

### 1. Start the server

```bash
cd server
npm install
cp .env.example .env    # optional: add SendGrid, SMTP or Twilio keys to send real OTPs
node index.js
```

The API runs on http://localhost:5001. Set `JWT_SECRET` in `.env` to your own random string, since the built-in default is only meant for local testing.

### 2. Start the client

In a second terminal:

```bash
cd client
npm install
npm start
```

The app opens at http://localhost:3000. It forwards API calls to port 5001.

### 3. Log in

The repo comes with two demo accounts (no real user data is included):

| Role | Email | Password |
|------|-------|----------|
| Farmer | farmer@example.com | Demo@1234 |
| Admin | admin@example.com | Admin@1234 |

You can also sign up for a new account. If you haven't set up an email or SMS provider, check the server terminal for the OTP and enter it on the verify page.

### Adding an admin

Admins are kept in `server/data/admins.json`. To add one, make a password hash:

```bash
cd server
node -e "console.log(require('bcryptjs').hashSync('YourPassword', 10))"
```

Then add an entry to the file:

```json
[
  { "username": "admin", "email": "admin@example.com", "password": "<hash from above>" }
]
```

## Project structure

```
client/                 React app
  src/pages/            landing, login, sign-up, OTP, dashboards, admin pages
  src/components/       soil gauges, quick stats, weather card, modals
server/
  index.js              Express API (auth, OTP, datasets, recommendations, history, profiles)
  data/                 JSON storage and uploaded CSV datasets
  .env.example          template for OTP provider keys
```

## Known limitations

- Data is stored in JSON files, so it suits a demo or a single machine, not many users at once. A real database would be the next step.
- The admin API routes don't check the JWT yet, so anyone who can reach the server could call them. Adding auth middleware to those routes is next on the list.
- The weather card shows sample data and isn't connected to a weather API.
