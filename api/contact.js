// api/contact.js
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, email, subject, category, message } = req.body || {};

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  // Message length guard
  if (message.length > 2000) {
    return res.status(400).json({ error: "Message too long" });
  }

  try {
    await resend.emails.send({
from: `Prism Support <contact@prism-app.online>`,      to: process.env.SENDER_EMAIL,
      subject: `[Prism Contact] [${category}] ${subject}`,
      replyTo: email,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0a0d14; color: #e4e4e7; border-radius: 12px;">
          <h2 style="color: #8b5cf6; margin-bottom: 24px;">New Contact Form from Prism</h2>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="padding: 8px 0; color: #a1a1aa; width: 100px;">Name</td>
              <td style="padding: 8px 0; color: #e4e4e7; font-weight: 600;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #a1a1aa;">Email</td>
              <td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #8b5cf6;">${email}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #a1a1aa;">Category</td>
              <td style="padding: 8px 0; color: #e4e4e7; text-transform: capitalize;">${category}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #a1a1aa;">Subject</td>
              <td style="padding: 8px 0; color: #e4e4e7;">${subject}</td>
            </tr>
          </table>

          <div style="background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 16px;">
            <p style="color: #a1a1aa; margin: 0 0 8px 0; font-size: 0.875rem;">Message</p>
            <p style="color: #e4e4e7; margin: 0; line-height: 1.6; white-space: pre-wrap;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
          </div>

          <p style="color: #52525b; font-size: 0.75rem; margin-top: 24px;">
            Sent via Prism contact form • Reply directly to this email to respond to ${name}
          </p>
        </div>
      `,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Resend error:", error);
    return res.status(500).json({ error: "Failed to send email" });
  }
}