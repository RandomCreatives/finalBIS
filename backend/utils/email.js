const nodemailer = require('nodemailer');
const env = require('../config/env');

/**
 * Minimal email sender used by the Gmail-verification and passwordless
 * sign-in flows. If SMTP is not configured (local development), messages are
 * written to the server log instead and the caller can surface the code in a
 * dev-only response.
 */

const smtpConfigured = () => Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);

let transporter = null;

const getTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: env.smtp.host,
            port: env.smtp.port,
            secure: env.smtp.secure,
            auth: { user: env.smtp.user, pass: env.smtp.pass },
        });
    }
    return transporter;
};

/**
 * Sends an email. Returns true if the message was handed to an SMTP server,
 * false if SMTP is not configured (in which case it is logged instead).
 */
const sendMail = async ({ to, subject, text, html }) => {
    if (!smtpConfigured()) {
        console.log(`\n[email][dev] To: ${to}\n[email][dev] Subject: ${subject}\n[email][dev] ${text}\n`);
        return false;
    }
    await getTransporter().sendMail({
        from: env.smtp.from,
        to,
        subject,
        text,
        html,
    });
    return true;
};

/** 6-digit code used by both the link and the login flows. */
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

module.exports = { sendMail, smtpConfigured, generateCode };
