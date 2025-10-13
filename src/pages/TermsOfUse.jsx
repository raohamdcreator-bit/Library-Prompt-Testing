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
            By accessing and using Prompt Teams ("the Service"), you accept and
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
            Prompt Teams provides a collaborative platform for creating,
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
            6. AI Enhancement Features
          </h2>
          <p className="leading-relaxed mb-3">
            Our AI enhancement features are powered by third-party providers
            (Groq, HuggingFace, OpenRouter). By using these features:
          </p>
          <ul className="space-y-2 ml-6">
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                You acknowledge that AI-generated suggestions may contain errors
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                You are responsible for reviewing and validating AI outputs
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                Your prompts may be processed by third-party AI services
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                We are not liable for AI-generated content quality or accuracy
              </span>
            </li>
          </ul>
        </section>

        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            7. Payment and Subscription
          </h2>
          <p className="leading-relaxed">
            Currently, Prompt Teams is offered free of charge. If we introduce
            paid features in the future, we will provide advance notice and
            updated terms. Your continued use after such changes constitutes
            acceptance.
          </p>
        </section>

        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            8. Intellectual Property
          </h2>

          <h3
            className="text-lg font-semibold mb-2 mt-4"
            style={{ color: "var(--foreground)" }}
          >
            8.1 Our Property
          </h3>
          <p className="leading-relaxed mb-3">
            The Service, including its design, code, features, and trademarks,
            is owned by Prompt Teams and protected by intellectual property
            laws. You may not:
          </p>
          <ul className="space-y-2 ml-6">
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>Copy, modify, or distribute our intellectual property</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>Create derivative works based on the Service</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>Use our trademarks without permission</span>
            </li>
          </ul>

          <h3
            className="text-lg font-semibold mb-2 mt-4"
            style={{ color: "var(--foreground)" }}
          >
            8.2 Your Property
          </h3>
          <p className="leading-relaxed">
            You retain all rights to your User Content. We do not claim
            ownership of prompts or content you create.
          </p>
        </section>

        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            9. Disclaimers
          </h2>
          <div
            className="p-4 rounded-lg border mb-3"
            style={{
              backgroundColor: "var(--secondary)",
              borderColor: "var(--border)",
            }}
          >
            <p className="leading-relaxed font-semibold">
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND,
              EXPRESS OR IMPLIED. WE DISCLAIM ALL WARRANTIES INCLUDING
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
              NON-INFRINGEMENT.
            </p>
          </div>
          <p className="leading-relaxed">
            We do not guarantee that the Service will be uninterrupted, secure,
            or error-free. Use of the Service is at your own risk.
          </p>
        </section>

        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            10. Limitation of Liability
          </h2>
          <div
            className="p-4 rounded-lg border mb-3"
            style={{
              backgroundColor: "var(--secondary)",
              borderColor: "var(--border)",
            }}
          >
            <p className="leading-relaxed font-semibold">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, PROMPT TEAMS SHALL NOT BE
              LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
              PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE.
            </p>
          </div>
          <p className="leading-relaxed">
            Our total liability for any claims related to the Service shall not
            exceed $100 or the amount you paid us in the past 12 months,
            whichever is greater.
          </p>
        </section>

        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            11. Indemnification
          </h2>
          <p className="leading-relaxed">
            You agree to indemnify and hold harmless Prompt Teams from any
            claims, damages, or expenses arising from your use of the Service,
            violation of these terms, or infringement of any rights of another
            party.
          </p>
        </section>

        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            12. Third-Party Services
          </h2>
          <p className="leading-relaxed mb-3">
            The Service integrates with third-party services including:
          </p>
          <ul className="space-y-2 ml-6">
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                <strong>Google/Firebase:</strong> Authentication and database
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                <strong>Resend:</strong> Email delivery
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                <strong>AI Providers:</strong> Groq, HuggingFace, OpenRouter
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                <strong>Vercel:</strong> Hosting and deployment
              </span>
            </li>
          </ul>
          <p className="leading-relaxed mt-3">
            Your use of these services is subject to their respective terms and
            privacy policies. We are not responsible for third-party services.
          </p>
        </section>

        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            13. Data Backup and Loss
          </h2>
          <p className="leading-relaxed">
            While we implement regular backups, you are responsible for
            maintaining your own copies of important content. We are not liable
            for any data loss or corruption.
          </p>
        </section>

        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            14. Modifications to Service
          </h2>
          <p className="leading-relaxed">
            We reserve the right to modify, suspend, or discontinue the Service
            (or any part thereof) at any time with or without notice. We shall
            not be liable for any modification, suspension, or discontinuance.
          </p>
        </section>

        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            15. Changes to Terms
          </h2>
          <p className="leading-relaxed">
            We may update these Terms of Use from time to time. We will notify
            you of material changes by email or through the Service. Your
            continued use after changes constitutes acceptance of the updated
            terms.
          </p>
        </section>

        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            16. Governing Law
          </h2>
          <p className="leading-relaxed">
            These terms shall be governed by and construed in accordance with
            the laws of [Your Jurisdiction], without regard to its conflict of
            law provisions.
          </p>
        </section>

        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            17. Dispute Resolution
          </h2>
          <p className="leading-relaxed mb-3">
            In the event of any dispute arising from these terms:
          </p>
          <ul className="space-y-2 ml-6">
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                You agree to first attempt to resolve the dispute informally by
                contacting us
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                If unresolved after 30 days, disputes shall be resolved through
                binding arbitration
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                You waive any right to participate in class-action lawsuits
              </span>
            </li>
          </ul>
        </section>

        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            18. Severability
          </h2>
          <p className="leading-relaxed">
            If any provision of these terms is found to be unenforceable, the
            remaining provisions shall continue in full force and effect.
          </p>
        </section>

        <section>
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            19. Contact Information
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
              <strong>Email:</strong> legal@prompt-teams.com
            </p>
            <p>
              <strong>Contact Form:</strong>{" "}
              <a href="/contact" style={{ color: "var(--primary)" }}>
                prompt-teams.com/contact
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
            By using Prompt Teams, you acknowledge that you have read,
            understood, and agree to be bound by these Terms of Use.
          </p>
        </section>
      </div>
    </LegalLayout>
  );
}
