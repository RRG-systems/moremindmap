import { useState } from "react"

export default function Page0B_ContextualSignals({ onComplete }) {
  const [signals, setSignals] = useState({
    best_role_ever: "",
    best_role_why: "",
    worst_role_ever: "",
    worst_role_why: "",
    current_energy_drain: "",
    current_role_misalignment: "",
    avoided_work: "",
    recurring_org_frustration: "",
    relied_on_for: "",
    misunderstood_for: "",
    unrealized_capacity: "",
  })

  const [errors, setErrors] = useState({})

  const requiredFields = ["current_energy_drain", "relied_on_for"]

  const questions = [
    {
      id: "best_role_ever",
      label: "What was the best job, role, or work environment you've ever had?",
      required: false,
    },
    {
      id: "best_role_why",
      label: "Why did it work so well for you?",
      required: false,
    },
    {
      id: "worst_role_ever",
      label: "What was the worst job, role, or work environment you've ever had?",
      required: false,
    },
    {
      id: "worst_role_why",
      label: "Why did it drain, frustrate, or limit you?",
      required: false,
    },
    {
      id: "current_energy_drain",
      label: "What currently drains the most energy from your work life?",
      required: true,
    },
    {
      id: "current_role_misalignment",
      label: "What part of your current role feels most misaligned with how you naturally operate?",
      required: false,
    },
    {
      id: "avoided_work",
      label: "What kind of work do you avoid even when you know it matters?",
      required: false,
    },
    {
      id: "recurring_org_frustration",
      label: "What problem inside your organization frustrates you repeatedly?",
      required: false,
    },
    {
      id: "relied_on_for",
      label: "What do people consistently rely on you for?",
      required: true,
    },
    {
      id: "misunderstood_for",
      label: "What do people misunderstand about how you operate?",
      required: false,
    },
    {
      id: "unrealized_capacity",
      label: "What do you suspect you are capable of that your current life or role is not fully using?",
      required: false,
    },
  ]

  function updateField(id, value) {
    setSignals((prev) => ({ ...prev, [id]: value }))
    // Clear error for this field if it now has content
    if (value.trim()) {
      setErrors((prev) => ({ ...prev, [id]: false }))
    }
  }

  function validate() {
    const newErrors = {}
    requiredFields.forEach((field) => {
      if (!signals[field] || !signals[field].trim()) {
        newErrors[field] = true
      }
    })
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleContinue() {
    if (validate()) {
      console.log("[PAGE 0B COMPLETE]", signals)
      onComplete(signals)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-12">
      {/* HEADER */}
      <div className="space-y-4 text-center">
        <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/60">
          Contextual Signal Layer
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          A few more questions.
        </h1>
        <p className="text-white/72 text-lg max-w-xl mx-auto">
          Before the assessment begins, we'd like to understand the environments where you
          perform best, where you've struggled, and what patterns are shaping your current life.
        </p>
        <p className="text-white/60 text-sm">
          Keep responses specific. Short answers are fine, but detail creates a stronger profile.
        </p>
      </div>

      {/* QUESTIONS */}
      <div className="space-y-8">
        {questions.map((question, idx) => (
          <div
            key={question.id}
            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 md:p-8 hover:border-white/20 transition"
          >
            {/* Question number + label */}
            <div className="space-y-2 mb-4">
              <div className="flex items-baseline gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  {idx + 1} of {questions.length}
                </span>
                {question.required && (
                  <span className="text-xs font-semibold uppercase tracking-wider text-red-400">
                    Required
                  </span>
                )}
              </div>
              <label className="block text-base md:text-lg font-medium text-white leading-relaxed">
                {question.label}
              </label>
            </div>

            {/* Textarea */}
            <textarea
              value={signals[question.id]}
              onChange={(e) => updateField(question.id, e.target.value)}
              placeholder="Your response here..."
              className={`w-full h-24 md:h-28 rounded-lg bg-white/5 border ${
                errors[question.id]
                  ? "border-red-400/60 focus:border-red-400"
                  : "border-white/15 focus:border-white/40"
              } text-white placeholder-white/40 px-4 py-3 focus:outline-none focus:ring-1 ${
                errors[question.id] ? "focus:ring-red-400/50" : "focus:ring-white/20"
              } transition resize-none font-normal text-base`}
            />

            {/* Error message */}
            {errors[question.id] && (
              <p className="text-xs text-red-400 mt-2">This field is required</p>
            )}
          </div>
        ))}
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex gap-4 justify-center pt-4">
        <button
          onClick={handleContinue}
          className="inline-flex items-center justify-center rounded-2xl bg-white text-black px-8 py-4 text-base font-medium hover:bg-white/90 transition shadow-[0_0_40px_rgba(255,255,255,0.1)]"
        >
          Continue to Assessment
        </button>
      </div>

      {/* METADATA PRIVACY NOTE */}
      <div className="text-center text-xs text-white/40 border-t border-white/10 pt-8">
        Your responses are analyzed locally to improve behavioral inference. They remain private
        within your profile.
      </div>
    </div>
  )
}
