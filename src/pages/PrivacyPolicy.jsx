// src/pages/PrivacyPolicy.jsx - Updated for Custom Navigation
import LegalLayout, { useNavigation } from "../components/LegalLayout";

export default function PrivacyPolicy() {
  const navigate = useNavigation();

  return (
    <LegalLayout title="Privacy Policy" lastUpdated="January 15, 2025">
      <div className="space-y-6" style={{ color: "var(--muted-foreground)" }}>
        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            1. Introduction
          </h2>
          <p className="leading-relaxed">
            Welcome to Prompt Teams ("we," "our," or "us"). We respect your
            privacy and are committed to protecting your personal data. This
            privacy policy explains how we collect, use, and safeguard your
            information when you use our service.
          </p>
        </section>

        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            2. Information We Collect
          </h2>

          <h3
            className="text-lg font-semibold mb-2 mt-4"
            style={{ color: "var(--foreground)" }}
          >
            2.1 Information You Provide
          </h3>
          <ul className="space-y-2 ml-6">
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                <strong>Account Information:</strong> Name, email address, and
                profile photo (via Google Sign-In)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                <strong>Content:</strong> AI prompts, comments, ratings, and
                team interactions you create
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                <strong>Communications:</strong> Messages you send to us via
                contact forms or support
              </span>
            </li>
          </ul>

          <h3
            className="text-lg font-semibold mb-2 mt-4"
            style={{ color: "var(--foreground)" }}
          >
            2.2 Automatically Collected Information
          </h3>
          <ul className="space-y-2 ml-6">
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                <strong>Usage Data:</strong> Pages viewed, features used, time
                spent on platform
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                <strong>Device Information:</strong> Browser type, operating
                system, IP address
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                <strong>Analytics:</strong> We use Firebase Analytics to improve
                our service
              </span>
            </li>
          </ul>
        </section>

        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            3. How We Use Your Information
          </h2>
          <ul className="space-y-2 ml-6">
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>To provide and maintain our service</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>To notify you about changes to our service</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>To provide customer support</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>To gather analysis to improve our service</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>To monitor usage and detect technical issues</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>To send team invitations and notifications</span>
            </li>
          </ul>
        </section>

        {/* Add remaining sections from original file... */}

        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            12. Contact Us
          </h2>
          <p className="leading-relaxed mb-3">
            If you have questions about this privacy policy or your data, please
            contact us:
          </p>
          <div
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: "var(--secondary)",
              borderColor: "var(--border)",
            }}
          >
            <p>
              <strong>Email:</strong> privacy@prompt-teams.com
            </p>
            <p>
              <strong>Contact Form:</strong>{" "}
              <button
                onClick={() => navigate && navigate("/contact")}
                style={{ color: "var(--primary)" }}
                className="hover:underline"
              >
                prompt-teams.com/contact
              </button>
            </p>
          </div>
        </section>
      </div>
    </LegalLayout>
  );
}
