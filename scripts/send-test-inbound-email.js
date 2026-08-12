/* eslint-disable no-console */
// Test utility: sends an email into the helpdesk inbox WITHOUT going through email.service
// (so the inbound poller treats it as a genuine incoming customer email).
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const subject = process.argv[2] || 'Test inbound ticket from email';
const body = process.argv[3] || 'This is a test email to verify email-to-ticket creation. Please create a ticket from this message.';
const sender = process.argv[4] || process.env.EMAIL_USER;

const appendViaImap = async () => {
  const { ImapFlow } = require('imapflow');
  const client = new ImapFlow({
    host: process.env.EMAIL_IMAP_HOST,
    port: Number(process.env.EMAIL_IMAP_PORT),
    secure: process.env.EMAIL_IMAP_SECURE === 'true',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    logger: false,
    tls: { rejectUnauthorized: false },
  });
  const raw = [
    `From: ${sender}`,
    `To: ${process.env.EMAIL_USER}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${Math.round(Math.random() * 1e9)}@${sender.split('@')[1] || 'email.test'}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].join('\r\n');
  await client.connect();
  const mailbox = process.env.EMAIL_IMAP_MAILBOX || 'INBOX';
  await client.append(mailbox, raw, []);
  await client.logout();
  console.log(`Appended to ${process.env.EMAIL_USER}/${mailbox} from ${sender}`);
};

const run = async () => {
  if (sender !== process.env.EMAIL_USER) {
    await appendViaImap();
    return;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
  });
  const info = await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject,
    text: body,
  });
  console.log(`Sent to ${process.env.EMAIL_USER}: ${info.messageId}`);
};

run().catch((err) => {
  console.error('Send failed:', err.message);
  process.exit(1);
});
