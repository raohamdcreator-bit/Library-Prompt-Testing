// src/pages/Waitlist.jsx - Real User Feedback Only
import { useState, useEffect } from "react";
import { Rocket, CheckCircle2, XCircle, Zap, MessageCircle, Crown, Star, Quote, MessageSquare } from "lucide-react";
import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";

// Star Rating Component
function StarRating({ rating, onRatingChange, interactive = false, size = 20 }) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => interactive && onRatingChange(star)}
          onMouseEnter={() => interactive && setHover(star)}
          onMouseLeave={() => interactive && setHover(0)}
          disabled={!interactive}
          className={`transition-all duration-200 ${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
          style={{ background: 'none', border: 'none', padding: 0 }}
        >
          <Star
            size={size}
            fill={star <= (hover || rating) ? "#fbbf24" : "none"}
            stroke={star <= (hover || rating) ? "#fbbf24" : "var(--muted-foreground)"}
            style={{ transition: 'all 0.2s ease' }}
          />
        </button>
      ))}
    </div>
  );
}

// Testimonial Card Component
function TestimonialCard({ testimonial }) {
  return (
    <div
      className="glass-card p-6 rounded-lg border h-full flex flex-col"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="mb-4">
        <Quote className="w-8 h-8 opacity-30" style={{ color: "var(--primary)" }} />
      </div>
      
      <p
        className="text-sm mb-4 flex-1 leading-relaxed"
        style={{ color: "var(--foreground)" }}
      >
        "{testimonial.feedback}"
      </p>
      
      <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: "var(--border)" }}>
        <div>
          <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
            {testimonial.name}
          </p>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {testimonial.role || "Early User"}
          </p>
        </div>
        <StarRating rating={testimonial.rating} interactive={false} size={16} />
      </div>
    </div>
  );
}

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
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  // Feedback form state
  const [feedbackData, setFeedbackData] = useState({
    name: "",
    email: "",
    rating: 0,
    feedback: "",
    category: "general",
  });
  const [feedbackStatus, setFeedbackStatus] = useState({ type: "", message: "" });
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // Real testimonials from Firebase
  const [testimonials, setTestimonials] = useState([]);
  const [isLoadingTestimonials, setIsLoadingTestimonials] = useState(true);

  // Fetch real feedback from Firebase
  useEffect(() => {
    async function fetchTestimonials() {
      try {
        // Query feedback with rating 4 or 5, ordered by rating then timestamp
        // Requires composite index: rating (desc) + timestamp (desc)
        const feedbackQuery = query(
          collection(db, "feedback"),
          where("rating", ">=", 4),
          orderBy("rating", "desc"),
          orderBy("timestamp", "desc"),
          limit(6)
        );
        
        const querySnapshot = await getDocs(feedbackQuery);
        const fetchedTestimonials = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedTestimonials.push({
            name: data.name,
            role: data.role || null,
            rating: data.rating,
            feedback: data.feedback,
          });
        });
        
        setTestimonials(fetchedTestimonials);
      } catch (error) {
        console.error("Error fetching testimonials:", error);
        // If index not ready yet, testimonials section won't show (graceful degradation)
      } finally {
        setIsLoadingTestimonials(false);
      }
    }

    fetchTestimonials();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleFeedbackChange = (e) => {
    const { name, value } = e.target;
    setFeedbackData((prev) => ({
      ...prev,
      [name]: value,
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

  const handleFeedbackSubmit = async () => {
    if (!feedbackData.name || !feedbackData.email || !feedbackData.rating || !feedbackData.feedback) {
      setFeedbackStatus({
        type: "error",
        message: "Please fill in all required fields and select a rating",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(feedbackData.email)) {
      setFeedbackStatus({
        type: "error",
        message: "Please enter a valid email address",
      });
      return;
    }

    setIsSubmittingFeedback(true);
    setFeedbackStatus({ type: "", message: "" });

    try {
      await addDoc(collection(db, "feedback"), {
        name: feedbackData.name.trim(),
        email: feedbackData.email.toLowerCase().trim(),
        rating: feedbackData.rating,
        feedback: feedbackData.feedback.trim(),
        category: feedbackData.category,
        timestamp: serverTimestamp(),
        source: "waitlist-page",
      });

      setFeedbackStatus({
        type: "success",
        message: "Thank you for your feedback! We appreciate your input.",
      });

      // Reset form data
      setFeedbackData({
        name: "",
        email: "",
        rating: 0,
        feedback: "",
        category: "general",
      });

      // Close form and reset status after showing success message
      setTimeout(() => {
        setShowFeedbackForm(false);
        setFeedbackStatus({ type: "", message: "" });
      }, 3000);
    } catch (error) {
      console.error("Feedback submission error:", error);
      setFeedbackStatus({
        type: "error",
        message: error.message || "Failed to submit feedback. Please try again.",
      });
    } finally {
      setIsSubmittingFeedback(false);
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

      {/* Testimonials Section - Only show if there are real testimonials */}
      {testimonials.length > 0 && (
        <section className="container mx-auto px-4 pb-16">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2
                className="text-3xl font-bold mb-4"
                style={{ color: "var(--foreground)" }}
              >
                What Early Users Say
              </h2>
              <p
                className="text-lg"
                style={{ color: "var(--muted-foreground)" }}
              >
                Real feedback from our community
              </p>
            </div>

            {isLoadingTestimonials ? (
              <div className="flex justify-center py-12">
                <div className="neo-spinner w-8 h-8"></div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {testimonials.map((testimonial, index) => (
                  <TestimonialCard key={index} testimonial={testimonial} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Waitlist Form */}
      <section className="container mx-auto px-4 pb-16">
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
                Reserve Your Spot
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
                  <span style={{ color: "var(--muted-foreground)" }}>
                    (optional)
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
                  Tell Us How You Plan to Use Prism{" "}
                  <span style={{ color: "var(--muted-foreground)" }}>
                    (optional)
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

              <div className="mt-6 pt-6 border-t" style={{ borderColor: "var(--border)" }}>
                <p
                  className="text-xs text-center"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  💡 Want to share feedback separately?{" "}
                  <button
                    onClick={() => {
                      setShowFeedbackForm(true);
                      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                    }}
                    className="text-primary hover:underline font-medium"
                  >
                    Leave feedback here
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feedback Form Section - Independent of Waitlist */}
      {showFeedbackForm && (
        <section className="container mx-auto px-4 pb-20">
          <div className="max-w-2xl mx-auto">
            <div
              className="glass-card p-8 md:p-12 rounded-lg border"
              style={{ borderColor: "var(--primary)" }}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <div className="w-16 h-16 mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--primary)" }}>
                    <Star className="w-8 h-8" style={{ color: "var(--primary-foreground)" }} />
                  </div>
                  <h2
                    className="text-2xl font-bold mb-2"
                    style={{ color: "var(--foreground)" }}
                  >
                    Share Your Thoughts
                  </h2>
                  <p
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Help us improve Prism by sharing your expectations and feedback. No waitlist signup required.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowFeedbackForm(false);
                    setFeedbackData({
                      name: "",
                      email: "",
                      rating: 0,
                      feedback: "",
                      category: "general",
                    });
                    setFeedbackStatus({ type: "", message: "" });
                  }}
                  className="btn-secondary p-2 ml-4"
                  title="Close feedback form"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
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
                    name="name"
                    value={feedbackData.name}
                    onChange={handleFeedbackChange}
                    className="form-input w-full"
                    placeholder="Your name"
                    disabled={isSubmittingFeedback}
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
                    name="email"
                    value={feedbackData.email}
                    onChange={handleFeedbackChange}
                    className="form-input w-full"
                    placeholder="you@example.com"
                    disabled={isSubmittingFeedback}
                  />
                </div>

                {/* Rating */}
                <div>
                  <label
                    className="block text-sm font-medium mb-3"
                    style={{ color: "var(--foreground)" }}
                  >
                    How excited are you about Prism? *
                  </label>
                  <div className="flex items-center gap-4">
                    <StarRating
                      rating={feedbackData.rating}
                      onRatingChange={(rating) =>
                        setFeedbackData((prev) => ({ ...prev, rating }))
                      }
                      interactive={true}
                      size={32}
                    />
                    {feedbackData.rating > 0 && (
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "var(--primary)" }}
                      >
                        {feedbackData.rating} / 5 stars
                      </span>
                    )}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label
                    htmlFor="category"
                    className="block text-sm font-medium mb-2"
                    style={{ color: "var(--foreground)" }}
                  >
                    Feedback Category
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={feedbackData.category}
                    onChange={handleFeedbackChange}
                    className="form-input w-full"
                    disabled={isSubmittingFeedback}
                  >
                    <option value="general">General Feedback</option>
                    <option value="features">Feature Requests</option>
                    <option value="experience">User Experience</option>
                    <option value="expectations">Expectations</option>
                  </select>
                </div>

                {/* Feedback */}
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
                    name="feedback"
                    value={feedbackData.feedback}
                    onChange={handleFeedbackChange}
                    rows={5}
                    className="form-input w-full resize-none"
                    placeholder="What are you most excited about? What features would you like to see?"
                    disabled={isSubmittingFeedback}
                    maxLength={1000}
                  />
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {feedbackData.feedback.length} / 1000 characters
                  </p>
                </div>

                {/* Feedback Status Message */}
                {feedbackStatus.message && (
                  <div
                    className={`p-4 rounded-lg border ${
                      feedbackStatus.type === "success"
                        ? "bg-green-500/10 border-green-500/30"
                        : "bg-red-500/10 border-red-500/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {feedbackStatus.type === "success" ? (
                        <CheckCircle2 className="w-5 h-5 text-green-300" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-300" />
                      )}
                      <p
                        className={
                          feedbackStatus.type === "success"
                            ? "text-green-300"
                            : "text-red-300"
                        }
                      >
                        {feedbackStatus.message}
                      </p>
                    </div>
                  </div>
                )}

                {/* Submit Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleFeedbackSubmit}
                    disabled={isSubmittingFeedback}
                    className="flex-1 btn-primary py-3 text-sm font-semibold flex items-center justify-center gap-2"
                    style={{ opacity: isSubmittingFeedback ? 0.7 : 1 }}
                  >
                    {isSubmittingFeedback ? (
                      <>
                        <div className="neo-spinner w-4 h-4"></div>
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Star className="w-4 h-4" />
                        <span>Submit Feedback</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowFeedbackForm(false)}
                    disabled={isSubmittingFeedback}
                    className="btn-secondary px-6 py-3"
                  >
                    Skip
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
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

      {/* Feedback Toggle CTA - Always visible */}
      <section className="container mx-auto px-4 pb-16">
        <div className="max-w-2xl mx-auto">
          {!showFeedbackForm ? (
            <div
              className="glass-card p-8 rounded-lg border text-center transition-all hover:border-primary/50"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex flex-col items-center">
                <div
                  className="w-14 h-14 mb-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "var(--primary)", opacity: 0.9 }}
                >
                  <MessageSquare className="w-7 h-7" style={{ color: "var(--primary-foreground)" }} />
                </div>
                <h3
                  className="text-xl font-bold mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  Share Your Feedback
                </h3>
                <p
                  className="mb-6 max-w-md"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Already exploring AI tools? Share your thoughts and help shape Prism's development — no signup required.
                </p>
                <button
                  onClick={() => setShowFeedbackForm(true)}
                  className="btn-primary px-8 py-3 flex items-center justify-center gap-2"
                >
                  <Star className="w-4 h-4" />
                  <span>Leave Feedback</span>
                </button>
              </div>
            </div>
          ) : null}
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
