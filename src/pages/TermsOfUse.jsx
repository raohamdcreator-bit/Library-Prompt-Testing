// src/pages/TermsOfUse.jsx
import LegalLayout from "../components/LegalLayout";

export default function TermsOfUse() {
  return (
    <LegalLayout title="Terms of Use" lastUpdated="January 15, 2025">
      <div className="space-y-6" style={{ color: "var(--muted-foreground)" }}>
        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            1. Acceptance of Terms
          </h2>
          <p className="leading-relaxed">
            By accessing and using Prism ("the Service"), you accept and
            agree to be bound by these Terms of Use. If you do not agree to
            these terms, please do not use the Service.
          </p>
        </section>

        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            2. Description of Service
          </h2>
          <p className="leading-relaxed mb-3">
            Prism provides a collaborative platform for creating,
            sharing, and managing AI prompts within teams. The Service includes:
          </p>
          <ul className="space-y-2 ml-6">
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>Prompt library management and organization</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                Team collaboration features with role-based permissions
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>AI enhancement tools powered by third-party APIs</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>Analytics and usage tracking</span>
            </li>
          </ul>
        </section>

        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            3. User Accounts
          </h2>

          <h3
            className="text-lg font-semibold mb-2 mt-4"
            style={{ color: "var(--foreground)" }}
          >
            3.1 Account Creation
          </h3>
          <p className="leading-relaxed mb-3">
            To use the Service, you must create an account using Google Sign-In.
            You agree to:
          </p>
          <ul className="space-y-2 ml-6">
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>Provide accurate and complete information</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>Maintain the security of your account credentials</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>Notify us immediately of any unauthorized access</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>Be responsible for all activities under your account</span>
            </li>
          </ul>

          <h3
            className="text-lg font-semibold mb-2 mt-4"
            style={{ color: "var(--foreground)" }}
          >
            3.2 Account Termination
          </h3>
          <p className="leading-relaxed">
            You may terminate your account at any time. We reserve the right to
            suspend or terminate accounts that violate these terms.
          </p>
        </section>

        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            4. User Content
          </h2>

          <h3
            className="text-lg font-semibold mb-2 mt-4"
            style={{ color: "var(--foreground)" }}
          >
            4.1 Your Content
          </h3>
          <p className="leading-relaxed mb-3">
            You retain ownership of prompts and content you create ("User
            Content"). By posting content, you grant us a license to:
          </p>
          <ul className="space-y-2 ml-6">
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                Store, display, and transmit your content within the Service
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                Share your content with your team members as configured
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>Process your content through AI enhancement features</span>
            </li>
          </ul>

          <h3
            className="text-lg font-semibold mb-2 mt-4"
            style={{ color: "var(--foreground)" }}
          >
            4.2 Content Restrictions
          </h3>
          <p className="leading-relaxed mb-3">
            You agree not to post content that:
          </p>
          <ul className="space-y-2 ml-6">
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>Violates laws or regulations</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>Infringes on intellectual property rights</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>Contains malicious code or spam</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>Harasses, threatens, or harms others</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>Contains false or misleading information</span>
            </li>
          </ul>
        </section>

        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            5. Acceptable Use
          </h2>
          <p className="leading-relaxed mb-3">
            You agree to use the Service only for lawful purposes. Prohibited
            activities include:
          </p>
          <ul className="space-y-2 ml-6">
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                Attempting to access unauthorized areas of the Service
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>Interfering with or disrupting the Service</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                Using automated tools to access the Service (except authorized
                APIs)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                Reverse engineering or attempting to extract source code
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                Selling, reselling, or commercializing the Service without
                permission
              </span>
            </li>
          </ul>
        </section>

        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            6. Contact Information
          </h2>
          <p className="leading-relaxed mb-3">
            For questions about these Terms of Use, please contact us:
          </p>
          <div
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: "var(--secondary)",
              borderColor: "var(--border)",
            }}
          >
            <p>
              <strong>Email:</strong> research.prismhq@gmail.com
            </p>
            <p>
              <strong>Contact Form:</strong>{" "}
              <a href="/contact" style={{ color: "var(--primary)" }}>
                prism.com/contact
              </a>
            </p>
          </div>
        </section>

        <section
          className="p-6 rounded-lg border text-center"
          style={{
            backgroundColor: "var(--muted)",
            borderColor: "var(--border)",
          }}
        >
          <p className="text-sm font-semibold">
            By using Prism, you acknowledge that you have read,
            understood, and agree to be bound by these Terms of Use.
          </p>
        </section>
      </div>
    </LegalLayout>
  );
}
