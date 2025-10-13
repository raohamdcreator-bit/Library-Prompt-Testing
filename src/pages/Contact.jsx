// src/pages/Contact.jsx - Updated for Custom Navigation
import { useState } from "react";
import LegalLayout, { useNavigation } from "../components/LegalLayout";

export default function Contact() {
  const navigate = useNavigation();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    category: "general",
  });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: "", message: "" });

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setStatus({
        type: "success",
        message:
          "Thank you for contacting us! We'll respond within 24-48 hours.",
      });

      setFormData({
        name: "",
        email: "",
        subject: "",
        message: "",
        category: "general",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message:
          "Failed to send message. Please try again or email us directly.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LegalLayout title="Contact Us">
      <div className="space-y-8">
        <section className="text-center">
          <p className="text-lg" style={{ color: "var(--muted-foreground)" }}>
            Have questions, feedback, or need support? We're here to help!
          </p>
        </section>

        <section className="grid md:grid-cols-3 gap-6">
          <div
            className="p-6 rounded-lg border text-center"
            style={{
              backgroundColor: "var(--secondary)",
              borderColor: "var(--border)",
            }}
          >
            <div
              className="w-12 h-12 rounded-lg mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: "var(--primary)" }}
            >
              <span
                className="text-2xl"
                style={{ color: "var(--primary-foreground)" }}
              >
                📧
              </span>
            </div>
            <h3
              className="font-semibold mb-2"
              style={{ color: "var(--foreground)" }}
            >
              Email Support
            </h3>
            <p
              className="text-sm mb-3"
              style={{ color: "var(--muted-foreground)" }}
            >
              Get help via email
            </p>
            <a
              href="mailto:support@prompt-teams.com"
              className="text-sm"
              style={{ color: "var(--primary)" }}
            >
              support@prompt-teams.com
            </a>
          </div>

          <div
            className="p-6 rounded-lg border text-center"
            style={{
              backgroundColor: "var(--secondary)",
              borderColor: "var(--border)",
            }}
          >
            <div
              className="w-12 h-12 rounded-lg mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: "var(--primary)" }}
            >
              <span
                className="text-2xl"
                style={{ color: "var(--primary-foreground)" }}
              >
                💬
              </span>
            </div>
            <h3
              className="font-semibold mb-2"
              style={{ color: "var(--foreground)" }}
            >
              Live Chat
            </h3>
            <p
              className="text-sm mb-3"
              style={{ color: "var(--muted-foreground)" }}
            >
              Chat with our team
            </p>
            <span
              className="text-sm"
              style={{ color: "var(--muted-foreground)" }}
            >
              Coming Soon
            </span>
          </div>

          <div
            className="p-6 rounded-lg border text-center"
            style={{
              backgroundColor: "var(--secondary)",
              borderColor: "var(--border)",
            }}
          >
            <div
              className="w-12 h-12 rounded-lg mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: "var(--primary)" }}
            >
              <span
                className="text-2xl"
                style={{ color: "var(--primary-foreground)" }}
              >
                📚
              </span>
            </div>
            <h3
              className="font-semibold mb-2"
              style={{ color: "var(--foreground)" }}
            >
              Documentation
            </h3>
            <p
              className="text-sm mb-3"
              style={{ color: "var(--muted-foreground)" }}
            >
              Browse our guides
            </p>
            <button
              onClick={() => navigate && navigate("/")}
              className="text-sm"
              style={{ color: "var(--primary)" }}
            >
              View Docs
            </button>
          </div>
        </section>

        <section>
          <div
            className="p-6 rounded-lg border"
            style={{
              backgroundColor: "var(--secondary)",
              borderColor: "var(--border)",
            }}
          >
            <h2
              className="text-2xl font-bold mb-6"
              style={{ color: "var(--foreground)" }}
            >
              Send us a Message
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium mb-2"
                    style={{ color: "var(--foreground)" }}
                  >
                    Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 rounded-lg border"
                    style={{
                      backgroundColor: "var(--input)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium mb-2"
                    style={{ color: "var(--foreground)" }}
                  >
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 rounded-lg border"
                    style={{
                      backgroundColor: "var(--input)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                    placeholder="john@company.com"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="category"
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  Category *
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-lg border"
                  style={{
                    backgroundColor: "var(--input)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  <option value="general">General Inquiry</option>
                  <option value="support">Technical Support</option>
                  <option value="bug">Bug Report</option>
                  <option value="feature">Feature Request</option>
                  <option value="billing">Billing Question</option>
                  <option value="partnership">Partnership</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="subject"
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  Subject *
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-lg border"
                  style={{
                    backgroundColor: "var(--input)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                  placeholder="How can we help you?"
                />
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  Message *
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={6}
                  className="w-full px-4 py-3 rounded-lg border resize-none"
                  style={{
                    backgroundColor: "var(--input)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                  placeholder="Please provide as much detail as possible..."
                />
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {formData.message.length} / 2000 characters
                </p>
              </div>

              {status.message && (
                <div
                  className={`p-4 rounded-lg border ${
                    status.type === "success"
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-red-500/10 border-red-500/30"
                  }`}
                >
                  <p
                    className={
                      status.type === "success"
                        ? "text-green-300"
                        : "text-red-300"
                    }
                  >
                    {status.message}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full btn-primary py-3 text-lg font-semibold flex items-center justify-center gap-2"
                style={{ opacity: isSubmitting ? 0.7 : 1 }}
              >
                {isSubmitting ? (
                  <>
                    <div className="neo-spinner w-5 h-5"></div>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <span>Send Message</span>
                    <span>📤</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </section>

        <section>
          <h2
            className="text-2xl font-bold mb-6"
            style={{ color: "var(--foreground)" }}
          >
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            {[
              {
                q: "How quickly will I receive a response?",
                a: "We typically respond to all inquiries within 24-48 hours during business days. Critical issues are prioritized and may receive faster responses.",
              },
              {
                q: "Do you offer phone support?",
                a: "Currently, we provide support via email and our contact form. Phone support may be available for enterprise customers in the future.",
              },
              {
                q: "Can I request new features?",
                a: 'Absolutely! We love hearing feature requests from our users. Select "Feature Request" as the category when contacting us.',
              },
              {
                q: "How do I report a security issue?",
                a: "For security-related concerns, please email security@prompt-teams.com directly. We take security reports very seriously.",
              },
            ].map((faq, index) => (
              <details
                key={index}
                className="p-4 rounded-lg border"
                style={{
                  backgroundColor: "var(--secondary)",
                  borderColor: "var(--border)",
                }}
              >
                <summary
                  className="font-semibold cursor-pointer"
                  style={{ color: "var(--foreground)" }}
                >
                  {faq.q}
                </summary>
                <p
                  className="mt-3 text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section
          className="p-6 rounded-lg border text-center"
          style={{
            backgroundColor: "var(--muted)",
            borderColor: "var(--border)",
          }}
        >
          <h3
            className="font-semibold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            Business Hours
          </h3>
          <p style={{ color: "var(--muted-foreground)" }}>
            Monday - Friday: 9:00 AM - 6:00 PM (PST)
            <br />
            Saturday - Sunday: Closed
            <br />
            <span className="text-sm">
              Emergency support available 24/7 for critical issues
            </span>
          </p>
        </section>
      </div>
    </LegalLayout>
  );
}
