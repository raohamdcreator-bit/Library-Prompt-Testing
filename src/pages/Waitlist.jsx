// src/pages/Waitlist.jsx - Complete Waitlist Page
import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function Waitlist({ onNavigate }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "",
    institution: "",
    useCase: "",
    earlyAccess: true,
  });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: "", message: "" });

    try {
      // Validate required fields
      if (!formData.name || !formData.email || !formData.role) {
        throw new Error("Please fill in all required fields");
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        throw new Error("Please enter a valid email address");
      }

      // Submit to Firestore
      await addDoc(collection(db, "waitlist"), {
        name: formData.name.trim(),
        email: formData.email.toLowerCase().trim(),
        role: formData.role,
        institution: formData.institution.trim() || null,
        useCase: formData.useCase.trim() || null,
        earlyAccess: formData.earlyAccess,
        timestamp: serverTimestamp(),
        status: "waitlisted",
        source: "website",
      });

      setStatus({
        type: "success",
        message:
          "You're on the list! We'll reach out soon with early access details.",
      });

      // Reset form
      setFormData({
        name: "",
        email: "",
        role: "",
        institution: "",
        useCase: "",
        earlyAccess: true,
      });
    } catch (error) {
      console.error("Waitlist submission error:", error);
      setStatus({
        type: "error",
        message: error.message || "Failed to join waitlist. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Navigation */}
      <nav
        className="border-b"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => onNavigate("/")}
            >
              <div className="w-8 h-8 flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="Prism Logo"
                  className="w-full h-full object-contain"
                  style={{
                    filter: "drop-shadow(0 0 8px rgba(168, 85, 247, 0.4))",
                  }}
                />
              </div>
              <span
                className="text-xl font-bold"
                style={{ color: "var(--foreground)" }}
              >
                Prism
              </span>
            </div>
            <button
              onClick={() => onNavigate("/")}
              className="btn-secondary px-6 py-2"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <div
            className="mb-6 ai-glow inline-flex items-center gap-2 px-4 py-2 rounded-full border"
            style={{
              backgroundColor: "var(--primary)",
              color: "var(--secondary-foreground)",
              borderColor: "var(--border)",
              boxShadow: "0 0 10px var(--glow-purple-bright)",
            }}
          >
            <span className="text-sm">🚀</span>
            <span className="text-sm font-medium">Limited Early Access</span>
          </div>

          <h1
            className="text-3xl md:text-7xl font-normal mb-6"
            style={{ color: "var(--foreground)" }}
          >
            Join Early Pioneers
          </h1>

          <p
            className="text-xl mb-12 max-w-3xl mx-auto leading-relaxed"
            style={{ color: "var(--muted-foreground)" }}
          >
            Join early pioneers shaping the future of AI-assisted development
            and prompt education.
          </p>
        </div>
      </section>

      {/* Waitlist Form */}
      <section className="container mx-auto px-4 pb-20">
        <div className="max-w-2xl mx-auto">
          <div
            className="glass-card p-8 md:p-12 rounded-lg border"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="text-center mb-8">
              <h2
                className="text-3xl font-bold mb-4"
                style={{ color: "var(--foreground)" }}
              >
                Be the First to Shape Prism
              </h2>
              <p
                className="text-lg"
                style={{ color: "var(--muted-foreground)" }}
              >
                Join the early access group of AI builders, educators &
                innovators.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name */}
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
                  className="form-input w-full"
                  placeholder="Your full name"
                  disabled={isSubmitting}
                />
              </div>

              {/* Email */}
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
                  className="form-input w-full"
                  placeholder="you@example.com"
                  disabled={isSubmitting}
                />
              </div>

              {/* Role */}
              <div>
                <label
                  htmlFor="role"
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  Select Role *
                </label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                  className="form-input w-full"
                  disabled={isSubmitting}
                >
                  <option value="">Choose your role...</option>
                  <option value="student">Student</option>
                  <option value="educator">Educator / Researcher</option>
                  <option value="team">Team / Startup</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="creator">Creator / Freelancer</option>
                </select>
              </div>

              {/* Institution */}
              <div>
                <label
                  htmlFor="institution"
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  Institution / Company{" "}
                  <span style={{ color: "var(--muted-foreground)" }}>
                    (required)
                  </span>
                </label>
                <input
                  type="text"
                  id="institution"
                  name="institution"
                  value={formData.institution}
                  onChange={handleChange}
                  className="form-input w-full"
                  placeholder="Your school, university, or company"
                  disabled={isSubmitting}
                />
              </div>

              {/* Use Case */}
              <div>
                <label
                  htmlFor="useCase"
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  Tell Us How You Plan to Use Prism?{" "}
                  <span style={{ color: "var(--muted-foreground)" }}>
                    (required)
                  </span>
                </label>
                <textarea
                  id="useCase"
                  name="useCase"
                  value={formData.useCase}
                  onChange={handleChange}
                  rows={4}
                  className="form-input w-full resize-none"
                  placeholder="Tell us about your use case... (e.g., teaching AI to students, managing team prompts, building AI tools)"
                  disabled={isSubmitting}
                  maxLength={500}
                />
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {formData.useCase.length} / 500 characters
                </p>
              </div>

              {/* Early Access Checkbox */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="earlyAccess"
                  name="earlyAccess"
                  checked={formData.earlyAccess}
                  onChange={handleChange}
                  className="mt-1"
                  disabled={isSubmitting}
                  style={{ accentColor: "var(--primary)" }}
                />
                <label
                  htmlFor="earlyAccess"
                  className="text-sm cursor-pointer"
                  style={{ color: "var(--foreground)" }}
                >
                  I want early access to Prism and agree to provide feedback to
                  help shape the platform
                </label>
              </div>

              {/* Status Message */}
              {status.message && (
                <div
                  className={`p-4 rounded-lg border ${
                    status.type === "success"
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-red-500/10 border-red-500/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">
                      {status.type === "success" ? "✅" : "❌"}
                    </span>
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
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full btn-primary ai-glow py-4 text-lg font-semibold flex items-center justify-center gap-2"
                style={{ opacity: isSubmitting ? 0.7 : 1 }}
              >
                {isSubmitting ? (
                  <>
                    <div className="neo-spinner w-5 h-5"></div>
                    <span>Joining Waitlist...</span>
                  </>
                ) : (
                  <>
                    <span>Reserve Your Spot</span>
                    <span>→</span>
                  </>
                )}
              </button>

              <p
                className="text-xs text-center"
                style={{ color: "var(--muted-foreground)" }}
              >
                By joining, you'll be among the first to access Prism and help
                shape its development. We respect your privacy and won't share
                your information.
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container mx-auto px-4 pb-20">
        <div className="max-w-4xl mx-auto text-center py-12">
          <h3
            className="text-2xl font-bold mb-8"
            style={{ color: "var(--foreground)" }}
          >
            What Early Access Members Get
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: "⚡",
                title: "Priority Access",
                desc: "Be first to try new features and AI governance tools",
              },
              {
                icon: "💬",
                title: "Direct Input",
                desc: "Shape the platform with your feedback and ideas",
              },
              {
                icon: "👑",
                title: "Exclusive Resources",
                desc: "Early access to guides, tutorials, and best practices",
              },
            ].map((benefit, index) => (
              <div
                key={index}
                className="glass-card p-6 rounded-lg border"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="text-4xl mb-4">{benefit.icon}</div>
                <h4
                  className="font-semibold mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  {benefit.title}
                </h4>
                <p
                  className="text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {benefit.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="border-t"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            © 2025 Prism. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
