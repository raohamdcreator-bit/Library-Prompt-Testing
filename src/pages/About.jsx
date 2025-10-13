// src/pages/About.jsx
import LegalLayout from "../components/LegalLayout";

export default function About() {
  return (
    <LegalLayout title="About Prompt Teams">
      <div className="space-y-8">
        {/* Mission Section */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🎯</span>
            <h2
              className="text-2xl font-bold"
              style={{ color: "var(--foreground)" }}
            >
              Our Mission
            </h2>
          </div>
          <p
            style={{ color: "var(--muted-foreground)" }}
            className="leading-relaxed mb-4"
          >
            Prompt Teams is dedicated to revolutionizing how teams collaborate
            on AI prompts. We believe that effective prompt engineering is
            essential for maximizing AI potential, and collaboration amplifies
            creativity and results.
          </p>
          <p
            style={{ color: "var(--muted-foreground)" }}
            className="leading-relaxed"
          >
            Our platform provides intuitive tools for creating, sharing, and
            optimizing AI prompts, making advanced AI accessible to teams of all
            sizes.
          </p>
        </section>

        {/* What We Offer */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">✨</span>
            <h2
              className="text-2xl font-bold"
              style={{ color: "var(--foreground)" }}
            >
              What We Offer
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: "var(--secondary)",
                borderColor: "var(--border)",
              }}
            >
              <h3
                className="font-semibold mb-2"
                style={{ color: "var(--foreground)" }}
              >
                🧠 Smart Library
              </h3>
              <p
                className="text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                Organize and categorize your prompts with intelligent tagging
                and powerful search capabilities.
              </p>
            </div>
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: "var(--secondary)",
                borderColor: "var(--border)",
              }}
            >
              <h3
                className="font-semibold mb-2"
                style={{ color: "var(--foreground)" }}
              >
                👥 Team Collaboration
              </h3>
              <p
                className="text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                Share prompts with your team and collaborate in real-time with
                role-based permissions.
              </p>
            </div>
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: "var(--secondary)",
                borderColor: "var(--border)",
              }}
            >
              <h3
                className="font-semibold mb-2"
                style={{ color: "var(--foreground)" }}
              >
                ⭐ Ratings & Favorites
              </h3>
              <p
                className="text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                Save your best prompts and rate team contributions to build a
                quality library.
              </p>
            </div>
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: "var(--secondary)",
                borderColor: "var(--border)",
              }}
            >
              <h3
                className="font-semibold mb-2"
                style={{ color: "var(--foreground)" }}
              >
                📊 Analytics
              </h3>
              <p
                className="text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                Track usage patterns and optimize your prompt performance with
                detailed insights.
              </p>
            </div>
          </div>
        </section>

        {/* Technology */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">⚙️</span>
            <h2
              className="text-2xl font-bold"
              style={{ color: "var(--foreground)" }}
            >
              Technology Stack
            </h2>
          </div>
          <p
            style={{ color: "var(--muted-foreground)" }}
            className="leading-relaxed mb-4"
          >
            Built with modern web technologies to ensure speed, security, and
            reliability:
          </p>
          <ul
            className="space-y-2"
            style={{ color: "var(--muted-foreground)" }}
          >
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                <strong>React 19</strong> - Fast, modern user interface
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                <strong>Firebase</strong> - Real-time database and
                authentication
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                <strong>AI Integration</strong> - Groq, HuggingFace, and
                OpenRouter support
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "var(--primary)" }}>•</span>
              <span>
                <strong>Vercel Hosting</strong> - Global CDN for optimal
                performance
              </span>
            </li>
          </ul>
        </section>

        {/* Contact CTA */}
        <section
          className="p-6 rounded-lg border text-center"
          style={{
            backgroundColor: "var(--secondary)",
            borderColor: "var(--primary)",
          }}
        >
          <h3
            className="text-xl font-bold mb-2"
            style={{ color: "var(--foreground)" }}
          >
            Get in Touch
          </h3>
          <p className="mb-4" style={{ color: "var(--muted-foreground)" }}>
            Have questions or feedback? We'd love to hear from you.
          </p>
          <a href="/contact" className="btn-primary px-6 py-3 inline-block">
            Contact Us
          </a>
        </section>
      </div>
    </LegalLayout>
  );
}
