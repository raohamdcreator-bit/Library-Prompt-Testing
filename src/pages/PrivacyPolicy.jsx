// src/pages/PrivacyPolicy.jsx
// §3.2 — Updated to include all legally required disclosures:
//   • Data processors (Groq, Resend, Sentry, Firebase/Google, GA4)
//   • Explicit GA4 disclosure (separate from Firebase Analytics)
//   • Full GDPR rights section
//   • Data retention policy
//   • Guest user data explained
//   • Cookies section (§3.3 — includes Firebase Auth session cookies)
//   • Contact method for privacy requests
import LegalLayout, { useNavigation } from "../components/LegalLayout";
import { reopenConsentBanner } from "../lib/cookieConsent";

const LAST_UPDATED = "February 26, 2026";
const CONTACT_EMAIL = "research.prismhq@gmail.com";

function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Bullet({ children }) {
  return (
    <li className="flex items-start gap-2">
      <span style={{ color: "var(--primary)" }}>•</span>
      <span>{children}</span>
    </li>
  );
}

export default function PrivacyPolicy() {
  const navigate = useNavigation();

  return (
    <LegalLayout title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <div className="space-y-6" style={{ color: "var(--muted-foreground)" }}>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
            1. Introduction
          </h2>
          <p className="leading-relaxed">
            Welcome to Prism ("we," "our," or "us"). We respect your privacy and are committed to
            protecting your personal data. This privacy policy explains how we collect, use, and
            safeguard your information when you use our service at{" "}
            <a href="https://prism-app.online" style={{ color: "var(--primary)" }}>
              prism-app.online
            </a>.
          </p>
          <p className="leading-relaxed mt-2">
            If you are located in the European Union or EEA, this policy also describes your rights
            under the GDPR. California residents may also have rights under the CCPA.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
            2. Information We Collect
          </h2>
          <h3 className="text-lg font-semibold mb-2 mt-4" style={{ color: "var(--foreground)" }}>
            2.1 Information You Provide
          </h3>
          <ul className="space-y-2 ml-6">
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Account Information:</strong> Name, email address, and profile photo (via Google Sign-In)</span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Content:</strong> AI prompts, comments, ratings, and team interactions you create</span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Communications:</strong> Messages you send via contact forms or support</span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Waitlist &amp; Feedback:</strong> Name, email, role, and optionally your use case</span></li>
          </ul>

          <h3 className="text-lg font-semibold mb-2 mt-4" style={{ color: "var(--foreground)" }}>
            2.2 Automatically Collected Information
          </h3>
          <ul className="space-y-2 ml-6">
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Usage Data:</strong> Pages viewed, features used, time spent on platform</span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Device Information:</strong> Browser type, operating system, IP address</span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Analytics:</strong> Firebase Analytics and, with your consent, Google Analytics 4 (GA4)</span></li>
          </ul>

          <h3 className="text-lg font-semibold mb-2 mt-4" style={{ color: "var(--foreground)" }}>
            2.3 Guest User Data
          </h3>
          <p className="leading-relaxed">
            If you access a shared team view without signing in, you are identified by a randomly generated
            token stored in your browser session and in our database. This token contains no personal
            information and is not linked to your identity unless you create an account. Guest tokens
            expire automatically (up to 30 days) and are then permanently deleted.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
            3. Cookies &amp; Tracking Technologies
          </h2>
          <p className="leading-relaxed mb-3">We use the following cookies and similar technologies:</p>
          <div className="rounded-lg border overflow-hidden mb-3" style={{ borderColor: "var(--border)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "rgba(139,92,246,.1)" }}>
                  {["Cookie / Storage Key", "Purpose", "Type", "Consent Required"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "var(--foreground)", borderBottom: "1px solid var(--border)", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Firebase Auth (__session, etc.)", "Keeps you signed in", "Strictly necessary", "No"],
                  ["prism_cookie_consent", "Stores your cookie preference", "Strictly necessary", "No"],
                  ["Google Analytics 4 (_ga, _gid)", "Usage analytics", "Analytics", "Yes"],
                  ["Firebase Analytics", "App performance monitoring", "Analytics", "Yes — same banner"],
                ].map(([name, purpose, type, consent], i) => (
                  <tr key={i} style={{ borderBottom: i < 3 ? "1px solid var(--border)" : "none" }}>
                    {[name, purpose, type, consent].map((cell, j) => (
                      <td key={j} style={{ padding: "8px 12px", color: "var(--muted-foreground)" }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="leading-relaxed">
            You can change your cookie preference at any time:{" "}
            <button onClick={reopenConsentBanner} style={{ color: "var(--primary)", textDecoration: "underline", cursor: "pointer" }}>
              Update cookie settings
            </button>.
            Strictly necessary cookies cannot be disabled.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
            4. Data Processors &amp; Third-Party Services
          </h2>
          <p className="leading-relaxed mb-3">
            We share data with the following third-party processors to operate our service:
          </p>
          <ul className="space-y-2 ml-6">
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Firebase / Google:</strong> Authentication, Firestore database, Firebase Analytics, and Cloud Storage. Data may be stored in the US. <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>Privacy policy</a></span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Google Analytics 4 (Google LLC):</strong> Usage analytics — loaded only with your consent. GA4 is a separate product from Firebase Analytics. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>Privacy policy</a></span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Vercel Inc.:</strong> Web hosting and serverless functions. Receives IP addresses and request metadata. <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>Privacy policy</a></span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Groq Inc.:</strong> AI prompt enhancement — your prompt text is sent to Groq's API for processing and is not stored by us after the request completes. <a href="https://groq.com/privacy-policy/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>Privacy policy</a></span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Resend Inc.:</strong> Transactional email delivery (team invitations). We share recipient email and team name only. <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>Privacy policy</a></span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Sentry (Functional Software, Inc.):</strong> Error tracking and performance monitoring. Personal data (email, user ID) is scrubbed before transmission. <a href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>Privacy policy</a></span></li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
            5. How We Use Your Information
          </h2>
          <ul className="space-y-2 ml-6">
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span><span>To provide and maintain our service</span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span><span>To notify you about changes to our service</span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span><span>To provide customer support</span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span><span>To improve our service using analytics (with consent)</span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span><span>To monitor usage and detect technical issues</span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span><span>To send team invitations and notifications</span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span><span>To comply with legal obligations</span></li>
          </ul>
          <p className="leading-relaxed mt-3">
            <strong style={{ color: "var(--foreground)" }}>Legal basis (GDPR):</strong> Contract
            performance (providing the service), legitimate interests (security, fraud prevention),
            consent (analytics cookies), and legal obligation where applicable.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
            6. Data Retention
          </h2>
          <ul className="space-y-2 ml-6">
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Account data</strong> is retained while your account is active. Deleting your account removes all associated data within 30 days.</span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Team data</strong> (prompts, comments, results) is retained until the team owner deletes the team.</span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Invite records</strong> are automatically expired after 7–30 days.</span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Waitlist and feedback submissions</strong> are retained until the relevant campaign ends, then deleted.</span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Guest tokens</strong> expire with the shared-access link (up to 30 days) and are then removed.</span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Error logs (Sentry)</strong> are automatically purged after 90 days.</span></li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
            7. Data Security
          </h2>
          <p className="leading-relaxed">
            We implement appropriate technical and organisational security measures including TLS
            encryption in transit, Firestore server-side encryption at rest, and authenticated API
            access controls. While we take these precautions, no method of transmission over the
            internet is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
            8. Your Rights
          </h2>
          <p className="leading-relaxed mb-3">
            Depending on your location, you have the following rights regarding your personal data:
          </p>
          <ul className="space-y-2 ml-6">
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Access:</strong> Request a copy of the personal data we hold about you</span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Rectification:</strong> Ask us to correct inaccurate or incomplete data</span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Erasure ("right to be forgotten"):</strong> Ask us to delete your personal data</span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Restriction:</strong> Ask us to pause processing of your data in certain circumstances</span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Portability:</strong> Receive your data in a structured, machine-readable format</span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Objection:</strong> Object to processing based on legitimate interests</span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Withdraw consent:</strong> Withdraw analytics consent at any time via{" "}
                <button onClick={reopenConsentBanner} style={{ color: "var(--primary)", textDecoration: "underline", cursor: "pointer" }}>cookie settings</button></span></li>
            <li className="flex items-start gap-2"><span style={{ color: "var(--primary)" }}>•</span>
              <span><strong>Lodge a complaint:</strong> Contact your local data protection authority (e.g. ICO in the UK, or your EU supervisory authority)</span></li>
          </ul>
          <p className="leading-relaxed mt-3">
            To exercise any of these rights, contact us at the address in Section 10. We will
            respond within 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
            9. Children's Privacy
          </h2>
          <p className="leading-relaxed">
            Prism is not directed at children under the age of 13. We do not knowingly collect
            personal information from children under 13. If you become aware that a child has
            provided us with personal data, please contact us and we will delete it promptly.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
            10. Contact Us
          </h2>
          <p className="leading-relaxed mb-3">
            For privacy questions, data access requests, or to exercise any of your rights:
          </p>
          <div className="p-4 rounded-lg border" style={{ backgroundColor: "var(--secondary)", borderColor: "var(--border)" }}>
            <p>
              <strong>Email:</strong>{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--primary)" }}>{CONTACT_EMAIL}</a>
            </p>
            <p className="mt-1">
              <strong>Contact Form:</strong>{" "}
              <button onClick={() => navigate && navigate("/contact")} style={{ color: "var(--primary)" }} className="hover:underline">
                prism-app.online/contact
              </button>
            </p>
            <p className="mt-1 text-sm">We aim to respond to all privacy-related requests within <strong>30 days</strong>.</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
            11. Changes to This Policy
          </h2>
          <p className="leading-relaxed">
            We may update this policy from time to time. When we do, we will update the "Last
            Updated" date at the top of this page and, for material changes, notify you by email
            or a prominent in-app notice.
          </p>
        </section>

      </div>
    </LegalLayout>
  );
}
