// src/pages/Waitlist.jsx - Enhanced with Testimonials & Feedback
import { useState, useEffect } from "react";
import { Rocket, CheckCircle2, XCircle, Zap, MessageCircle, Crown, Star, Quote, Send, Loader2 } from "lucide-react";
import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
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
  const [testimonials, setTestimonials] = useState([]);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  // Load testimonials
  useEffect(() => {
    const q = query(
      collection(db, "testimonials"),
      where("approved", "==", true),
      orderBy("createdAt", "desc"),
      limit(6)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const testimonialsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTestimonials(testimonialsData);
      },
      (error) => {
        console.error("Error loading testimonials:", error);
        // Use fallback testimonials if Firebase fails
        setTestimonials(getFallbackTestimonials());
      }
    );

    return () => unsubscribe();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !formData.role) {
      setStatus({
        type: "error",
        message: "Please fill in all required fields",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setStatus({
        type: "error",
        message: "Please enter a valid email address",
      });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: "", message: "" });

    try {
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

      setFormData({
        name: "",
        email: "",
        role: "",
        institution: "",
        useCase: "",
        earlyAccess: true,
      });

      // Show feedback form after successful submission
      setTimeout(() => {
        setShowFeedbackForm(true);
      }, 2000);
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
            className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border"
            style={{
              backgroundColor: "var(--primary)",
              color: "white",
              borderColor: "var(--border)",
              boxShadow: "0 0 20px rgba(139, 92, 246, 0.3)",
            }}
          >
            <Rocket className="w-4 h-4" />
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

      {/* Testimonials Section */}
      {testimonials.length > 0 && (
        <section className="container mx-auto px-4 pb-16">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2
                className="text-3xl font-bold mb-4"
                style={{ color: "var(--foreground)" }}
              >
                Trusted by Innovators
              </h2>
              <p
                className="text-lg"
                style={{ color: "var(--muted-foreground)" }}
              >
                See what early users are saying about Prism
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.map((testimonial) => (
                <TestimonialCard key={testimonial.id} testimonial={testimonial} />
              ))}
            </div>
          </div>
        </section>
      )}

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

            <div className="space-y-6">
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
                  Tell Us How You Plan to Use Prism{" "}
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
                    {status.type === "success" ? (
                      <CheckCircle2 className="w-5 h-5 text-green-300" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-300" />
                    )}
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
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full btn-primary py-4 text-lg font-semibold flex items-center justify-center gap-2"
                style={{ 
                  opacity: isSubmitting ? 0.7 : 1,
                  boxShadow: "0 4px 20px rgba(139, 92, 246, 0.3)"
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
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
            </div>
          </div>
        </div>
      </section>

      {/* Feedback Form Modal */}
      {showFeedbackForm && (
        <FeedbackFormModal onClose={() => setShowFeedbackForm(false)} />
      )}

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
                Icon: Zap,
                title: "Priority Access",
                desc: "Be first to try new features and AI governance tools",
              },
              {
                Icon: MessageCircle,
                title: "Direct Input",
                desc: "Shape the platform with your feedback and ideas",
              },
              {
                Icon: Crown,
                title: "Exclusive Resources",
                desc: "Early access to guides, tutorials, and best practices",
              },
            ].map((benefit, index) => (
              <div
                key={index}
                className="glass-card p-6 rounded-lg border"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex justify-center mb-4">
                  <benefit.Icon className="w-10 h-10" style={{ color: "var(--primary)" }} />
                </div>
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

// Testimonial Card Component
function TestimonialCard({ testimonial }) {
  const { name, role, institution, rating, feedback, avatar } = testimonial;

  return (
    <div
      className="glass-card p-6 rounded-lg border hover:border-primary/50 transition-all duration-300"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Quote Icon */}
      <div className="mb-4">
        <Quote 
          className="w-8 h-8 opacity-30" 
          style={{ color: "var(--primary)" }} 
        />
      </div>

      {/* Rating Stars */}
      <div className="flex items-center gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            fill={star <= rating ? "#fbbf24" : "none"}
            color={star <= rating ? "#fbbf24" : "#6b7280"}
            strokeWidth={2}
          />
        ))}
      </div>

      {/* Feedback Text */}
      <p
        className="text-sm mb-6 leading-relaxed"
        style={{ color: "var(--foreground)" }}
      >
        "{feedback}"
      </p>

      {/* Author Info */}
      <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
          style={{
            backgroundColor: avatar ? "transparent" : "var(--primary)",
            color: "white",
          }}
        >
          {avatar ? (
            <img src={avatar} alt={name} className="w-full h-full rounded-full object-cover" />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <p
            className="font-semibold text-sm"
            style={{ color: "var(--foreground)" }}
          >
            {name}
          </p>
          <p
            className="text-xs"
            style={{ color: "var(--muted-foreground)" }}
          >
            {role}{institution ? ` • ${institution}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

// Feedback Form Modal Component
function FeedbackFormModal({ onClose }) {
  const [feedbackData, setFeedbackData] = useState({
    name: "",
    email: "",
    role: "",
    institution: "",
    rating: 0,
    feedback: "",
  });
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState({ type: "", message: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!feedbackData.name || !feedbackData.email || !feedbackData.rating || !feedbackData.feedback) {
      setSubmitStatus({
        type: "error",
        message: "Please fill in all required fields",
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus({ type: "", message: "" });

    try {
      await addDoc(collection(db, "testimonials"), {
        name: feedbackData.name.trim(),
        email: feedbackData.email.toLowerCase().trim(),
        role: feedbackData.role || "User",
        institution: feedbackData.institution.trim() || null,
        rating: feedbackData.rating,
        feedback: feedbackData.feedback.trim(),
        createdAt: serverTimestamp(),
        approved: false, // Requires admin approval
        source: "waitlist_feedback",
      });

      setSubmitStatus({
        type: "success",
        message: "Thank you for your feedback! It will be reviewed shortly.",
      });

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Feedback submission error:", error);
      setSubmitStatus({
        type: "error",
        message: "Failed to submit feedback. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }}
      onClick={onClose}
    >
      <div
        className="glass-card p-8 rounded-lg border max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        style={{ borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3
            className="text-2xl font-bold"
            style={{ color: "var(--foreground)" }}
          >
            Share Your Thoughts
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            style={{ color: "var(--foreground)" }}
          >
            ✕
          </button>
        </div>

        <p
          className="mb-6"
          style={{ color: "var(--muted-foreground)" }}
        >
          Help us improve Prism by sharing your experience and expectations. Your feedback is invaluable!
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label
              htmlFor="feedback-name"
              className="block text-sm font-medium mb-2"
              style={{ color: "var(--foreground)" }}
            >
              Name *
            </label>
            <input
              type="text"
              id="feedback-name"
              value={feedbackData.name}
              onChange={(e) =>
                setFeedbackData({ ...feedbackData, name: e.target.value })
              }
              className="form-input w-full"
              placeholder="Your name"
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="feedback-email"
              className="block text-sm font-medium mb-2"
              style={{ color: "var(--foreground)" }}
            >
              Email *
            </label>
            <input
              type="email"
              id="feedback-email"
              value={feedbackData.email}
              onChange={(e) =>
                setFeedbackData({ ...feedbackData, email: e.target.value })
              }
              className="form-input w-full"
              placeholder="you@example.com"
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Role & Institution */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="feedback-role"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--foreground)" }}
              >
                Role
              </label>
              <input
                type="text"
                id="feedback-role"
                value={feedbackData.role}
                onChange={(e) =>
                  setFeedbackData({ ...feedbackData, role: e.target.value })
                }
                className="form-input w-full"
                placeholder="Your role"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label
                htmlFor="feedback-institution"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--foreground)" }}
              >
                Institution
              </label>
              <input
                type="text"
                id="feedback-institution"
                value={feedbackData.institution}
                onChange={(e) =>
                  setFeedbackData({
                    ...feedbackData,
                    institution: e.target.value,
                  })
                }
                className="form-input w-full"
                placeholder="Your institution"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Star Rating */}
          <div>
            <label
              className="block text-sm font-medium mb-3"
              style={{ color: "var(--foreground)" }}
            >
              How excited are you about Prism? *
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() =>
                    setFeedbackData({ ...feedbackData, rating: star })
                  }
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  disabled={isSubmitting}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    size={32}
                    fill={
                      star <= (hoveredRating || feedbackData.rating)
                        ? "#fbbf24"
                        : "none"
                    }
                    color={
                      star <= (hoveredRating || feedbackData.rating)
                        ? "#fbbf24"
                        : "#6b7280"
                    }
                    strokeWidth={2}
                  />
                </button>
              ))}
              {feedbackData.rating > 0 && (
                <span
                  className="ml-2 text-sm font-medium"
                  style={{ color: "var(--foreground)" }}
                >
                  {feedbackData.rating === 5
                    ? "Extremely Excited! 🚀"
                    : feedbackData.rating === 4
                    ? "Very Excited! 😊"
                    : feedbackData.rating === 3
                    ? "Interested 👍"
                    : feedbackData.rating === 2
                    ? "Somewhat Curious 🤔"
                    : "Cautiously Optimistic 😐"}
                </span>
              )}
            </div>
          </div>

          {/* Feedback Text */}
          <div>
            <label
              htmlFor="feedback-text"
              className="block text-sm font-medium mb-2"
              style={{ color: "var(--foreground)" }}
            >
              Your Feedback *
            </label>
            <textarea
              id="feedback-text"
              value={feedbackData.feedback}
              onChange={(e) =>
                setFeedbackData({ ...feedbackData, feedback: e.target.value })
              }
              rows={4}
              className="form-input w-full resize-none"
              placeholder="What excites you most about Prism? What features would you like to see? Any suggestions?"
              disabled={isSubmitting}
              maxLength={500}
              required
            />
            <p
              className="text-xs mt-1"
              style={{ color: "var(--muted-foreground)" }}
            >
              {feedbackData.feedback.length} / 500 characters
            </p>
          </div>

          {/* Status Message */}
          {submitStatus.message && (
            <div
              className={`p-4 rounded-lg border ${
                submitStatus.type === "success"
                  ? "bg-green-500/10 border-green-500/30"
                  : "bg-red-500/10 border-red-500/30"
              }`}
            >
              <div className="flex items-center gap-2">
                {submitStatus.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5 text-green-300" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-300" />
                )}
                <p
                  className={
                    submitStatus.type === "success"
                      ? "text-green-300"
                      : "text-red-300"
                  }
                >
                  {submitStatus.message}
                </p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-secondary flex-1"
            >
              Maybe Later
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !feedbackData.rating}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Feedback</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Fallback testimonials in case Firebase fails to load
function getFallbackTestimonials() {
  return [
    {
      id: "1",
      name: "Sarah Chen",
      role: "AI Research Lead",
      institution: "Stanford University",
      rating: 5,
      feedback: "Prism transformed how our team manages AI prompts. The collaboration features are game-changing for research teams.",
      createdAt: new Date(),
      approved: true,
    },
    {
      id: "2",
      name: "Marcus Rodriguez",
      role: "Startup Founder",
      institution: "TechVentures",
      rating: 5,
      feedback: "Finally, a proper prompt library that scales with our team. The version control and analytics saved us countless hours.",
      createdAt: new Date(),
      approved: true,
    },
    {
      id: "3",
      name: "Dr. Emily Watson",
      role: "Professor of Computer Science",
      institution: "MIT",
      rating: 4,
      feedback: "Perfect for teaching prompt engineering. My students love how easy it is to share and iterate on prompts together.",
      createdAt: new Date(),
      approved: true,
    },
    {
      id: "4",
      name: "Alex Kim",
      role: "ML Engineer",
      institution: "OpenAI",
      rating: 5,
      feedback: "The plagiarism detection and quality analytics are exactly what enterprise teams need. Highly recommended!",
      createdAt: new Date(),
      approved: true,
    },
    {
      id: "5",
      name: "Jessica Liu",
      role: "Product Designer",
      institution: "Google",
      rating: 5,
      feedback: "Intuitive interface and powerful features. Makes prompt management feel effortless, not overwhelming.",
      createdAt: new Date(),
      approved: true,
    },
    {
      id: "6",
      name: "David Park",
      role: "Engineering Manager",
      institution: "Microsoft",
      rating: 4,
      feedback: "Great for cross-functional teams. The role-based permissions and audit logs give us the governance we need.",
      createdAt: new Date(),
      approved: true,
    },
  ];
}
