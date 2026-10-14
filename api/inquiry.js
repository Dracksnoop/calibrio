// Sends a website inquiry straight to the photographer's inbox.
//
// Runs as a Vercel serverless function at /api/inquiry (Hostinger keeps using send-inquiry.php).
// The forms post here in the background and go to /thank-you/ when this answers { ok: true }.
//
// Settings — add these in Vercel → Project → Settings → Environment Variables, then redeploy:
//   SMTP_USER      the address that sends the mail, e.g. a Gmail address
//   SMTP_PASS      its password; for Gmail this must be a 16-character App Password
//                  (Google Account → Security → 2-Step Verification → App passwords)
//   SMTP_HOST      optional, default smtp.gmail.com
//   SMTP_PORT      optional, default 465
//   INQUIRY_TO     optional, default thyzfoto@gmail.com (where inquiries are delivered)
const nodemailer = require('nodemailer');

// The fields both forms can send, in the order they appear in the email.
const FIELDS = [
  ['fullName', 'Full name'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['instagram', 'Instagram'],
  ['weddingDate', 'Wedding date'],
  ['weddingLocation', 'Wedding location'],
  ['coverage', 'Looking for'],
  ['eventType', 'Day type'],
  ['budget', 'Ideal budget'],
  ['speaks', 'What speaks to them'],
  ['heardAbout', 'Heard about you from'],
  ['details', 'Details'],
];

const clean = (v, max) => String(Array.isArray(v) ? v.join(', ') : v == null ? '' : v)
  .replace(/\r\n?/g, '\n').trim().slice(0, max);
const oneLine = (v) => v.replace(/[\r\n]+/g, ' ');
const escapeHtml = (v) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return Object.fromEntries(new URLSearchParams(req.body));
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method' });
  }

  const body = readBody(req);

  // Spam trap: real visitors never see or fill this field. Pretend it worked.
  if (clean(body._gotcha, 200)) return res.status(200).json({ ok: true });

  const data = {};
  FIELDS.forEach(([key]) => { data[key] = clean(body[key], key === 'details' || key === 'speaks' ? 5000 : 300); });

  const email = oneLine(data.email);
  if (!data.fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !data.details) {
    return res.status(400).json({ ok: false, error: 'missing' });
  }

  const { SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) return res.status(503).json({ ok: false, error: 'not-configured' });

  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const rows = FIELDS.filter(([key]) => data[key]).map(([key, label]) => [label, data[key]]);
  const text = 'New wedding inquiry from the website.\n\n' +
    rows.map(([label, value]) => label + ': ' + value).join('\n') + '\n';
  const html = '<p>New wedding inquiry from the website.</p><table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">' +
    rows.map(([label, value]) => '<tr><td style="color:#7A6A5C;vertical-align:top;white-space:nowrap">' + escapeHtml(label) +
      '</td><td style="color:#2C1F18;white-space:pre-wrap">' + escapeHtml(value) + '</td></tr>').join('') + '</table>';

  try {
    await transport.sendMail({
      from: { name: 'Thyzfoto Website', address: SMTP_USER },
      to: process.env.INQUIRY_TO || 'thyzfoto@gmail.com',
      replyTo: { name: oneLine(data.fullName), address: email },
      subject: 'New wedding inquiry — ' + oneLine(data.fullName),
      text,
      html,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('inquiry mail failed:', err && err.message);
    return res.status(502).json({ ok: false, error: 'send-failed' });
  }
};
