const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
const path = require("path");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const dns = require('dns').promises;

// Optional SendGrid SDK initialization (if installed). This will set API key and data residency when configured.
let sgMail = null;
try {
  sgMail = require('@sendgrid/mail');
  if (process.env.SENDGRID_API_KEY) {
    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      // Allow configuring data residency via environment variable, e.g. SENDGRID_DATA_RESIDENCY=eu
      if (process.env.SENDGRID_DATA_RESIDENCY) {
        try {
          sgMail.setDataResidency(process.env.SENDGRID_DATA_RESIDENCY);
          console.log('SendGrid data residency set to', process.env.SENDGRID_DATA_RESIDENCY);
        } catch (e) {
          console.warn('Failed to set SendGrid data residency:', e && e.toString());
        }
      }
    } catch (e) {
      console.warn('Failed to initialize @sendgrid/mail with provided API key:', e && e.toString());
    }
  }
} catch (e) {
  // @sendgrid/mail not installed or failed to load; continue using HTTPS fallback
  sgMail = null;
}

const app = express();
app.use(cors());
app.use(express.json());

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const ADMINS_FILE = path.join(DATA_DIR, "admins.json");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const PENDING_FILE = path.join(DATA_DIR, "pending_signups.json");

// Dev toggle: when true, API responses will include OTP for easier testing.
const DEV_INCLUDE_OTP = process.env.DEV_INCLUDE_OTP === 'true';
// When true, do not send OTPs to phone numbers (SMS). Forces email-only delivery.
const OTP_EMAIL_ONLY = true;

// Helpers
async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}
async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOtpToDestination(dest, code, meta = {}) {
  // dest can be phone (E.164) or email. Try providers: Twilio (SMS), SendGrid (email), SMTP, console fallback.
  try {
    const twSid = process.env.TWILIO_ACCOUNT_SID;
    const twToken = process.env.TWILIO_AUTH_TOKEN;
    const twFrom = process.env.TWILIO_FROM;
    const sgKey = process.env.SENDGRID_API_KEY;
    const smtpHost = process.env.SMTP_HOST;

    const isEmail = typeof dest === 'string' && dest.includes('@');

    // 1) Twilio for SMS (only if destination looks like phone and Twilio is configured)
      // If OTP_EMAIL_ONLY is enabled, never send SMS even if Twilio is configured.
      if (!isEmail && !OTP_EMAIL_ONLY && twSid && twToken && twFrom) {
      try {
        const twilio = require('twilio')(twSid, twToken);
        const msg = await twilio.messages.create({ body: `Your verification code is ${code}`, from: twFrom, to: dest });
        console.log('Twilio SMS queued', msg && msg.sid);
        return { ok: true, provider: 'twilio', info: msg && msg.sid };
      } catch (err) {
        console.error('Twilio send error:', err && err.toString());
        return { ok: false, provider: 'twilio', error: (err && err.toString()) || 'Twilio error' };
      }
    }

    // 2) SendGrid for email - prefer SDK if available so we can capture response headers/message id
    if (isEmail && sgKey) {
      try {
        const payload = {
          personalizations: [{ to: [{ email: dest }] }],
          from: { email: process.env.FROM_EMAIL || 'no-reply@example.com' },
          subject: 'Your verification code',
          content: [
            { type: 'text/plain', value: `Your verification code is: ${code}` },
            { type: 'text/html', value: `<p>Your verification code is: <strong>${code}</strong></p>` }
          ]
        };
        // Attach SendGrid custom_args when we have a pending signup id so events can be correlated
        if (meta && meta.pendingId) payload.custom_args = { pendingId: meta.pendingId };

        // Use @sendgrid/mail SDK when present - it returns response headers we can persist
        if (sgMail) {
          try {
            const sgRes = await sgMail.send(payload);
            // sgMail.send may return an array with response objects
            const res0 = Array.isArray(sgRes) ? sgRes[0] : sgRes;
            const status = res0 && (res0.statusCode || res0.status) ? (res0.statusCode || res0.status) : 202;
            const headers = (res0 && res0.headers) || {};
            const messageId = headers['x-message-id'] || headers['X-Message-Id'] || headers['x-msg-id'] || headers['x-message-id'.toLowerCase()];
            const result = { ok: status >= 200 && status < 300, provider: 'sendgrid', status, messageId, headers };
            console.log('SendGrid SDK send result:', result);
            return result;
          } catch (err) {
            console.error('SendGrid SDK send error:', err && (err.toString() || err));
            // fallthrough to HTTPS attempt as a backup
          }
        }

        // Fallback: HTTPS request to SendGrid (will include res.headers)
        const https = require('https');
  const payloadStr = JSON.stringify(payload);
        const options = {
          hostname: 'api.sendgrid.com',
          path: '/v3/mail/send',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payloadStr),
            Authorization: `Bearer ${sgKey}`
          }
        };

  const sendResult = await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => { body += chunk.toString(); });
            res.on('end', () => {
              const status = res.statusCode;
              const headers = res.headers || {};
              if (status >= 200 && status < 300) return resolve({ ok: true, provider: 'sendgrid', status, headers });
              try {
                const parsed = body ? JSON.parse(body) : body;
                resolve({ ok: false, provider: 'sendgrid', status, body: parsed, headers });
              } catch (e) {
                resolve({ ok: false, provider: 'sendgrid', status, body, headers });
              }
            });
          });
          req.on('error', (e) => reject(e));
          req.write(payloadStr);
          req.end();
        });
        console.log('SendGrid send result:', sendResult);
        return sendResult;
      } catch (err) {
        console.error('SendGrid send error:', err && err.toString());
        return { ok: false, provider: 'sendgrid', error: (err && err.toString()) || 'SendGrid error' };
      }
    }

    // 3) SMTP via nodemailer for email
    if (isEmail && smtpHost) {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
        });

        const mailOptions = {
          from: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@example.com',
          to: dest,
          subject: 'Your verification code',
          text: `Your verification code is: ${code}`,
          html: `<p>Your verification code is: <strong>${code}</strong></p>`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('OTP email sent via SMTP:', info && (info.response || info));
        return { ok: true, provider: 'smtp', info: info && (info.response || info) };
      } catch (err) {
        console.error('Error sending OTP email via SMTP:', err && err.toString());
        return { ok: false, provider: 'smtp', error: (err && err.toString()) || 'SMTP error' };
      }
    }

    // Fallback: console log (development)
    console.log(`OTP for ${dest}: ${code}`);
    return { ok: true, provider: 'console' };
  } catch (err) {
    console.error('sendOtpToDestination error:', err && err.toString());
    return { ok: false, provider: 'internal', error: (err && err.toString()) || 'internal error' };
  }
}

// Email domain MX check
async function emailDomainAcceptsMail(email) {
  try {
    const parts = String(email || '').split('@');
    if (parts.length !== 2) return false;
    const domain = parts[1].toLowerCase();
    // Try MX records first
    try {
      const mx = await dns.resolveMx(domain);
      if (mx && mx.length > 0) return true;
    } catch (e) {
      // fallthrough to A/AAAA lookup
    }

    // Some domains may not have MX but accept mail on A/AAAA
    try {
      const a = await dns.resolve(domain);
      if (a && a.length > 0) return true;
    } catch (e) {
      // no A record
    }
    return false;
  } catch (err) {
    console.error('emailDomainAcceptsMail error:', err && err.toString());
    return false;
  }
}

// SendGrid Email Validation (optional) - returns { ok: boolean, raw }
async function validateEmailWithSendGrid(email) {
  const sgKey = process.env.SENDGRID_API_KEY;
  if (!sgKey) return { ok: true, raw: null };
  try {
    const https = require('https');
    const payload = JSON.stringify({ email });
    const options = {
      hostname: 'api.sendgrid.com',
      path: '/v3/validations/email',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        Authorization: `Bearer ${sgKey}`
      }
    };
    const result = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (d) => { body += d.toString(); });
        res.on('end', () => {
          const status = res.statusCode;
          try {
            const parsed = body ? JSON.parse(body) : body;
            resolve({ status, body: parsed });
          } catch (e) {
            resolve({ status, body });
          }
        });
      });
      req.on('error', (e) => reject(e));
      req.write(payload);
      req.end();
    });

    // Interpret common fields if present
    const body = result.body || {};
    // SendGrid validation may return fields like 'result' or 'verdict' or 'is_valid'
    let ok = true;
    if (result.status >= 200 && result.status < 300) {
      if (body && (body.result === 'Invalid' || body.verdict === 'invalid' || body.is_valid === false)) ok = false;
      // some responses include 'disposable' or 'deliverability' levels; conservative: if deliverability === 'UNDELIVERABLE' -> false
      if (body && body.deliverability && String(body.deliverability).toUpperCase().includes('UNDELIVER')) ok = false;
    } else {
      // non-2xx - treat as non decisive (fail open)
      ok = true;
    }

    return { ok, raw: body };
  } catch (err) {
    console.error('validateEmailWithSendGrid error:', err && err.toString());
    return { ok: true, raw: { error: err && err.toString() } };
  }
}

// Phone validation: if Twilio Lookup is configured, use it; otherwise basic E.164 format check
async function phoneNumberLooksValid(phone) {
  try {
    if (!phone) return false;
    const twSid = process.env.TWILIO_ACCOUNT_SID;
    const twToken = process.env.TWILIO_AUTH_TOKEN;
    if (twSid && twToken) {
      try {
        const client = require('twilio')(twSid, twToken);
        // Twilio Lookups may throw if number is invalid
        const lookup = await client.lookups.v1.phoneNumbers(phone).fetch();
        return !!lookup && !!lookup.phoneNumber;
      } catch (e) {
        console.error('Twilio lookup error:', e && e.toString());
        return false;
      }
    }

  // Basic E.164 check (require at least 8 digits total to avoid very short numbers)
  const e164 = /^\+?[1-9]\d{7,14}$/;
    return e164.test(String(phone));
  } catch (err) {
    console.error('phoneNumberLooksValid error:', err && err.toString());
    return false;
  }
}

async function ensureUploadsDir() {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  } catch (e) {
    // ignore
  }
}

// Create pending signup
app.post('/api/signup', async (req, res) => {
  try {
  const { phone, email, password, firstName, lastName, name } = req.body;
  // Require email now: we only send OTPs to email addresses.
  if (!password || !email) return res.status(400).json({ error: 'Missing required fields - email and password are required (OTP delivery is email-only)' });

    // Validate contact methods before creating pending signup
    if (email) {
      const ok = await emailDomainAcceptsMail(email);
      if (!ok) return res.status(400).json({ error: 'Email domain does not appear to accept mail' });
      // Run SendGrid validation if configured
      const sgValidation = await validateEmailWithSendGrid(email);
      if (sgValidation && sgValidation.ok === false) {
        // In dev include provider diagnostics
        if (DEV_INCLUDE_OTP) return res.status(400).json({ error: 'Email appears undeliverable', provider: 'sendgrid', validation: sgValidation.raw });
        return res.status(400).json({ error: 'Email appears undeliverable' });
      }
      // attach validation raw to request object in dev mode for later response diagnostics
      if (DEV_INCLUDE_OTP) req.sgValidation = sgValidation.raw;
    }
      // If an account already exists with this email, tell the user rather than creating a new pending
      if (email) {
        try {
          const existingUsers = await readJson(USERS_FILE);
          const found = existingUsers.find(u => u.email && u.email.toLowerCase() === String(email).toLowerCase());
          if (found) return res.status(400).json({ error: 'Email already registered' });
        } catch (e) {
          // ignore read errors here and continue; signup will fail later if necessary
        }
      }
    if (phone) {
      // Phone is accepted but OTPs will not be sent to phone numbers.
      const ok = await phoneNumberLooksValid(phone);
      if (!ok) return res.status(400).json({ error: 'Phone number looks invalid' });
    }

    const pending = await readJson(PENDING_FILE);
    // Remove any existing pending for same phone/email (allow retry)
    const filtered = pending.filter(p => !(phone && p.phone === phone) && !(email && p.email && p.email.toLowerCase() === String(email).toLowerCase()));

    const otp = generateOtp();
    const hashed = await bcrypt.hash(password, 10);
    const entry = {
      id: uuidv4(),
      phone: phone || null,
      email: email ? String(email).toLowerCase() : null,
      firstName: firstName || null,
      lastName: lastName || null,
      password: hashed,
      name: name || null,
      otp,
      otpExpires: Date.now() + 1000 * 60 * 10, // 10 minutes
      createdAt: Date.now()
    };

    filtered.push(entry);
    await writeJson(PENDING_FILE, filtered);

  // attempt send by email only (no SMS OTPs)
  const destination = email;
  const delivery = await sendOtpToDestination(destination, otp, { pendingId: entry.id });

    // persist delivery diagnostics on the pending record for later inspection
    try {
      console.log('Persisting delivery diagnostics for signup, entry id=', entry.id, 'delivery=', delivery);
      const allPending = await readJson(PENDING_FILE);
      const idx2 = allPending.findIndex(p => p.id === entry.id);
      if (idx2 !== -1) {
        allPending[idx2].lastDelivery = Object.assign({}, delivery, { when: Date.now() });
        await writeJson(PENDING_FILE, allPending);
        console.log('Persisted delivery diagnostics for signup, id=', entry.id);
      } else {
        console.warn('Could not find pending entry to persist delivery for signup, id=', entry.id);
      }
    } catch (e) {
      console.warn('Failed to persist delivery diagnostics for signup:', e && e.toString());
    }

    const resp = { message: 'Signup pending - verify OTP', otpRequired: true, pending: { id: entry.id, phone: entry.phone, email: entry.email } };
    if (DEV_INCLUDE_OTP) {
      resp.otp = otp;
      resp.delivery = delivery;
    }
    if (delivery && delivery.ok === false && !DEV_INCLUDE_OTP) resp.warning = `Delivery failed via ${delivery.provider}: ${delivery.error || JSON.stringify(delivery)}`;
    res.json(resp);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify OTP and create user
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { id, phone, email, otp } = req.body;
    if (!otp || (!id && !phone && !email)) return res.status(400).json({ error: 'Missing required fields' });

    const pending = await readJson(PENDING_FILE);
    const idx = pending.findIndex(p => (id && p.id === id) || (phone && p.phone === phone) || (email && p.email && p.email.toLowerCase() === String(email).toLowerCase()));
    if (idx === -1) return res.status(404).json({ error: 'Pending signup not found' });
    const rec = pending[idx];
    if (Date.now() > rec.otpExpires) return res.status(400).json({ error: 'OTP expired' });
    if (String(rec.otp) !== String(otp)) return res.status(400).json({ error: 'Invalid OTP' });

    // create user
    const users = await readJson(USERS_FILE);
  const newUser = {
    id: uuidv4(),
    firstName: rec.firstName || null,
    lastName: rec.lastName || null,
    phone: rec.phone || null,
    email: rec.email || null,
    password: rec.password,
    active: true,
    createdAt: new Date().toISOString()
  };
    users.push(newUser);
    await writeJson(USERS_FILE, users);

    // remove pending
    pending.splice(idx, 1);
    await writeJson(PENDING_FILE, pending);

  const { password, ...safeUser } = newUser;
  // sign a short-lived JWT to auto-login the user in the client
  const token = jwt.sign({ sub: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ message: 'Verified', user: safeUser, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Resend OTP
app.post('/api/resend-otp', async (req, res) => {
  try {
    const { phone, email } = req.body;
    // Resend by email only
    if (!email) return res.status(400).json({ error: 'Missing email (resend is email-only)' });
    const pending = await readJson(PENDING_FILE);
    const idx = pending.findIndex(p => (p.email && p.email.toLowerCase() === String(email).toLowerCase()));
    if (idx === -1) return res.status(404).json({ error: 'Pending signup not found' });
    const otp = generateOtp();
    pending[idx].otp = otp;
    pending[idx].otpExpires = Date.now() + 1000 * 60 * 10;
    await writeJson(PENDING_FILE, pending);
  // send by email only
  const destination = pending[idx].email;
  const delivery = await sendOtpToDestination(destination, otp, { pendingId: pending[idx].id });
    // persist delivery diagnostics on pending record
    try {
      console.log('Persisting delivery diagnostics for resend, contact=', phone || email, 'delivery=', delivery);
      const allPending = await readJson(PENDING_FILE);
      const idx2 = allPending.findIndex(p => (phone && p.phone === phone) || (email && p.email && p.email.toLowerCase() === String(email).toLowerCase()));
      if (idx2 !== -1) {
        allPending[idx2].lastDelivery = Object.assign({}, delivery, { when: Date.now() });
        await writeJson(PENDING_FILE, allPending);
        console.log('Persisted delivery diagnostics for resend, contact=', phone || email);
      } else {
        console.warn('Could not find pending entry to persist delivery for resend, contact=', phone || email);
      }
    } catch (e) {
      console.warn('Failed to persist delivery diagnostics for resend:', e && e.toString());
    }

    // Do not include the OTP in resend responses. In dev mode include delivery diagnostics only.
    const resp = { message: 'OTP resent' };
    if (DEV_INCLUDE_OTP) {
      resp.delivery = delivery;
    }
    if (delivery && delivery.ok === false && !DEV_INCLUDE_OTP) resp.warning = `Delivery failed via ${delivery.provider}: ${delivery.error || JSON.stringify(delivery)}`;
    res.json(resp);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Dev-only: list pending signups (include OTP only in dev mode)
app.get('/api/admin/pending', async (req, res) => {
  try {
    const pending = await readJson(PENDING_FILE);
    if (DEV_INCLUDE_OTP) return res.json(pending);
    // scrub otps
    const scrubbed = pending.map(({ otp, password, ...rest }) => rest);
    res.json(scrubbed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login endpoint - accepts { identifier, password } where identifier is email or phone
app.post('/api/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: 'Missing required fields' });

    const idLower = String(identifier || '').toLowerCase();

    // check admins first
    const admins = await readJson(ADMINS_FILE);
    const admin = admins.find(a => (a.email && a.email.toLowerCase() === idLower) || (a.phone && a.phone === identifier));
    if (admin) {
      const ok = await bcrypt.compare(password, admin.password || '');
      if (ok) return res.json({ role: 'admin', name: admin.name || admin.email });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // check users - if multiple users exist for the same identifier, try to find one whose password matches
      const users = await readJson(USERS_FILE);
      const matches = users.filter(u => (u.email && u.email.toLowerCase() === idLower) || (u.phone && u.phone === identifier));
      if (!matches || matches.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

      let matchedUser = null;
      for (const u of matches) {
        try {
          const ok = await bcrypt.compare(password, u.password || '');
          if (ok) { matchedUser = u; break; }
        } catch (e) {
          // continue trying other matches
        }
      }
      if (!matchedUser) return res.status(401).json({ error: 'Invalid credentials' });

      const { password: pw, ...safeUser } = matchedUser;
      // sign a token for the session
      const token = jwt.sign({ sub: matchedUser.id, email: matchedUser.email }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ role: 'user', user: safeUser, token });
  } catch (err) {
    console.error('login error:', err && err.toString());
    res.status(500).json({ error: 'Server error' });
  }
});

// Public endpoint: list users (admin UI calls this). Returns users without passwords.
app.get('/users', async (req, res) => {
  try {
    const users = await readJson(USERS_FILE);
    // Ensure active flag exists and remove password before returning
    const safe = users.map(u => {
      const { password, ...rest } = u;
      return Object.assign({ active: true }, rest);
    });
    res.json(safe);
  } catch (err) {
    console.error('/users error:', err && err.toString());
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle a user's active/passive state
app.patch('/users/:id/toggle', async (req, res) => {
  try {
    const userId = req.params.id;
    const users = await readJson(USERS_FILE);
    const idx = users.findIndex(u => String(u.id) === String(userId));
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    // Ensure active flag (default true)
    users[idx].active = typeof users[idx].active === 'boolean' ? !users[idx].active : false;
    await writeJson(USERS_FILE, users);
    const { password, ...safeUser } = users[idx];
    res.json({ user: safeUser });
  } catch (err) {
    console.error('/users/:id/toggle error:', err && err.toString());
    res.status(500).json({ error: 'Server error' });
  }
});

// API-prefixed endpoints for compatibility with client (client uses /api base)
app.get('/api/users', async (req, res) => {
  try {
    const users = await readJson(USERS_FILE);
    const safe = users.map(u => {
      const { password, ...rest } = u;
      return Object.assign({ active: true }, rest);
    });
    res.json(safe);
  } catch (err) {
    console.error('/api/users error:', err && err.toString());
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/users/:id/toggle', async (req, res) => {
  try {
    const userId = req.params.id;
    const users = await readJson(USERS_FILE);
    const idx = users.findIndex(u => String(u.id) === String(userId));
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    users[idx].active = typeof users[idx].active === 'boolean' ? !users[idx].active : false;
    await writeJson(USERS_FILE, users);
    const { password, ...safeUser } = users[idx];
    res.json({ user: safeUser });
  } catch (err) {
    console.error('/api/users/:id/toggle error:', err && err.toString());
    res.status(500).json({ error: 'Server error' });
  }
});

// Receive SendGrid event webhooks (recommended to set this URL in SendGrid UI)
// Note: in production you'd want to verify the signature and secure this endpoint.
app.post('/api/sendgrid/events', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    const now = Date.now();
    // persist raw events file
    const evFile = path.join(DATA_DIR, 'sendgrid_events.json');
    const existing = await readJson(evFile);
    await writeJson(evFile, existing.concat(events.map(e => Object.assign({ receivedAt: now }, e))));

    // Try to correlate events to pending signup entries
    const pending = await readJson(PENDING_FILE);
    let updates = 0;
    for (const ev of events) {
      // SendGrid may include custom_args.pendingId
      const pendingId = ev && ev.custom_args && ev.custom_args.pendingId;
      let idx = -1;
      if (pendingId) idx = pending.findIndex(p => p.id === pendingId);
      // fallback: match by recipient email
      if (idx === -1 && ev && ev.email) idx = pending.findIndex(p => p.email && p.email.toLowerCase() === String(ev.email).toLowerCase());
      if (idx !== -1) {
        pending[idx].sendgridEvents = pending[idx].sendgridEvents || [];
        pending[idx].sendgridEvents.push(Object.assign({ receivedAt: now }, ev));
        updates++;
      }
    }
    if (updates > 0) await writeJson(PENDING_FILE, pending);
    res.json({ ok: true, received: events.length, correlated: updates });
  } catch (err) {
    console.error('sendgrid events webhook error:', err && err.toString());
    res.status(500).json({ error: 'Server error' });
  }
});

async function cleanupPendingSignups() {
  try {
    const pending = await readJson(PENDING_FILE);
    const now = Date.now();
    // remove entries older than 24 hours or expired OTPs
    const kept = pending.filter(p => (p.createdAt && (now - p.createdAt) < 1000 * 60 * 60 * 24) && (!p.otpExpires || p.otpExpires > now));
    if (kept.length !== pending.length) {
      await writeJson(PENDING_FILE, kept);
      console.log('Cleaned up pending signups. kept:', kept.length);
    }
  } catch (err) {
    console.error('cleanupPendingSignups error:', err && err.toString());
  }
}

// Run cleanup on startup and schedule hourly cleanup
(async () => {
  await ensureUploadsDir();
  await cleanupPendingSignups();
  setInterval(cleanupPendingSignups, 1000 * 60 * 60); // every hour
})();

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
