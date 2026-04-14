import { useState, useMemo, useEffect } from "react"
import MiniProfileReport from "./components/reports/MiniProfileReport.jsx";
import MOREMINDMAP_QUESTIONS from "./lib/assessments/moremindmap-questions";

export default function Profile() {
  const [started, setStarted] = useState(false)
  const [step, setStep] = useState(0)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const [selectedOffer, setSelectedOffer] = useState(null)
  const [promoCode, setPromoCode] = useState("")
  const [promoValidated, setPromoValidated] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  // Use the locked 24-question set
  const questions = MOREMINDMAP_QUESTIONS
  const selectedSet = useMemo(() => ({
    id: "moremindmap_mini",
    questions: MOREMINDMAP_QUESTIONS,
  }), [])
  const [responses, setResponses] = useState({})

  const progress = Math.round(((step + 1) / questions.length) * 100)
  const currentAnswer = responses[questions[step].id] || null

  function selectAnswer(questionId, key) {
    setResponses((prev) => ({ ...prev, [questionId]: key }))
  }

  function validatePromoCode() {
    const code = promoCode.trim().toUpperCase()
    if (code === "FATHOMFREE") {
      setPromoValidated(true)
      setSelectedOffer("full_profile")
    }
  }

  async function handleStartAssessment() {
    // DEBUG: Log state when button is clicked
    console.log("[START ASSESSMENT CLICKED]", {
      selectedOffer,
      promoValidated,
      fullName: fullName.trim(),
      email: email.trim(),
    })

    // If promo is active, skip checkout and start assessment
    if (promoValidated) {
      console.log("[PROMO PATH] Starting assessment with FATHOMFREE")
      setStarted(true)
      return
    }

    // Otherwise, redirect to Stripe checkout
    if (!selectedOffer) {
      console.log("[ERROR] No selectedOffer but button was enabled?")
      return
    }

    console.log("[CHECKOUT PATH] Redirecting to Stripe with offer:", selectedOffer)
    setCheckoutLoading(true)
    try {
      const API = import.meta.env.VITE_API_URL || "https://moremindmap-backend.vercel.app"
      const res = await fetch(`${API}/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedOffer }),
      })

      const data = await res.json()
      console.log("[STRIPE SESSION RESPONSE]", data)
      if (data.url) {
        console.log("[REDIRECTING TO STRIPE]", data.url)
        window.location.href = data.url
      } else {
        console.error("[NO CHECKOUT URL] Response:", data)
      }
    } catch (error) {
      console.error("[CHECKOUT ERROR]", error)
    }
    setCheckoutLoading(false)
  }

  function goNext() {
    console.log("BUTTON CLICKED — goNext() called")
    console.log("STEP:", step)
    console.log("TOTAL QUESTIONS:", questions.length)
    console.log("CURRENT ANSWER:", currentAnswer)
    
    if (!currentAnswer) {
      console.log("BLOCKED: currentAnswer is falsy")
      return
    }
    
    if (step < questions.length - 1) {
      console.log("NOT FINAL STEP — advancing to next question")
      setStep(step + 1)
    } else {
      console.log("FINAL STEP — CALLING submitAssessment()")
      submitAssessment()
    }
  }

  function goBack() {
    if (step > 0) setStep(step - 1)
  }

  async function submitAssessment() {
    console.log("SUBMIT FUNCTION TRIGGERED")
    setSubmitting(true)
    try {
      // Transform responses to new format: { questionId: answer }
      const answers = {}
      questions.forEach((q) => {
        answers[q.id] = responses[q.id] || null
      })

      console.log("LIVE ANSWERS OBJECT", answers)
      console.log("LIVE ANSWER COUNT", Object.keys(answers).length)
      console.log("[SUBMIT] Total questions:", questions.length)
      console.log("[SUBMIT] Answers keys:", Object.keys(answers).length)
      console.log("[SUBMIT] Full payload:", JSON.stringify({ answers }, null, 2))

      // Use env-based API URL
      const API = import.meta.env.VITE_API_URL || "https://moremindmap-backend.vercel.app"
      const endpoint = `${API}/api/moremindmap/mini-profile`
      console.log("[SUBMIT] API endpoint:", endpoint)

      console.log("ABOUT TO CALL API")
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
        }),
      })

      console.log("[RESPONSE] Status:", res.status)
      console.log("[RESPONSE] Headers:", res.headers.get("content-type"))

      // Handle non-JSON responses
      if (!res.ok) {
        const text = await res.text()
        console.error("[RESPONSE] Error text:", text)
        return setResult({
          success: false,
          error: `Server error (${res.status}): ${text}`,
        })
      }

      // Safely parse JSON
      let data
      try {
        data = await res.json()
      } catch (jsonError) {
        console.error("[JSON ERROR] Failed to parse:", jsonError)
        const text = await res.text()
        console.error("[JSON ERROR] Response was:", text)
        return setResult({
          success: false,
          error: `Invalid response format: ${jsonError.message}`,
        })
      }

      console.log("API RESPONSE RECEIVED", data)
      console.log("[SUBMIT] Assessment submitted:", data)
      console.log("[SUBMIT] miniProfile keys:", data.miniProfile ? Object.keys(data.miniProfile) : "NO miniProfile")
      console.log("[SUBMIT] Has what_this_means?", data.miniProfile?.what_this_means ? "YES" : "NO")
      console.log("[SUBMIT] Has dominance_structure?", data.miniProfile?.dominance_structure ? "YES" : "NO")
      console.log("[SUBMIT] Has dominance_note?", data.miniProfile?.dominance_note ? "YES" : "NO")
      
      // Show processing screen for 2 seconds before displaying report
      setProcessing(true)
      setTimeout(() => {
        setProcessing(false)
        setResult(data)
      }, 2000)
    } catch (error) {
      console.error("[SUBMIT] Assessment submission error:", error)
      console.error("[SUBMIT] Error stack:", error.stack)
      setResult({ success: false, error: error.message || "Connection failed. Please try again." })
    }
    setSubmitting(false)
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <ProfileBackground />

      <div className="relative z-10 px-6 py-16 md:py-20">
        <div className="max-w-4xl mx-auto">

          {/* INTRO SCREEN */}
          {!started && !submitted && (
            <IntroScreen
              fullName={fullName}
              setFullName={setFullName}
              email={email}
              setEmail={setEmail}
              selectedOffer={selectedOffer}
              setSelectedOffer={setSelectedOffer}
              promoCode={promoCode}
              setPromoCode={setPromoCode}
              promoValidated={promoValidated}
              validatePromoCode={validatePromoCode}
              onStart={handleStartAssessment}
              checkoutLoading={checkoutLoading}
            />
          )}

          {/* QUESTION FLOW */}
          {started && !submitted && !submitting && (
            <QuestionScreen
              step={step}
              total={questions.length}
              progress={progress}
              question={questions[step]}
              selectedKey={currentAnswer}
              onSelect={(key) => selectAnswer(questions[step].id, key)}
              onNext={goNext}
              onBack={goBack}
              isFirst={step === 0}
              isLast={step === questions.length - 1}
            />
          )}

          {/* SUBMITTING */}
          {submitting && (
            <div className="space-y-8">
              <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md p-8 md:p-10 shadow-2xl shadow-black/30 text-center">
                <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/60">
                  Processing
                </div>
                <h1 className="mt-6 text-3xl md:text-4xl font-semibold tracking-tight">
                  Building your MORE MindMap profile…
                </h1>
                <p className="mt-4 text-white/60 text-lg">This may take a moment.</p>
                <div className="mt-8 flex justify-center">
                  <LoadingDots />
                </div>
              </div>
            </div>
          )}

          {/* COMPLETION */}
          {submitted && (
            <div className="space-y-8">
              <a
                href="/"
                className="inline-flex items-center text-sm text-white/60 hover:text-white transition"
              >
                ← Back to Home
              </a>

              {/* PROCESSING SCREEN */}
              {processing && (
                <ProcessingScreen />
              )}

              {/* NEW: 5-PAGE MINI PROFILE REPORT */}
              {!processing && result?.success && result?.miniProfile && (
                <>
                  <div className="bg-white text-black rounded-[2rem] shadow-2xl overflow-hidden">
                    <MiniProfileReport 
                      scoringPayload={result?.scoringPayload || {}}
                      miniProfile={result?.miniProfile || {}}
                      userName={fullName}
                    />
                  </div>
                  <a
                    href="/"
                    className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-base font-medium text-white hover:bg-white/10 transition"
                  >
                    ← Back to Home
                  </a>
                </>
              )}

              {/* FALLBACK: Missing profile data */}
              {!processing && result?.success && !result?.miniProfile && (
                <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md p-8 md:p-10 shadow-2xl shadow-black/30">
                  <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/60">
                    Processing
                  </div>
                  <h1 className="mt-6 text-3xl md:text-4xl font-semibold tracking-tight">
                    Your profile is being generated…
                  </h1>
                  <p className="mt-4 text-white/60 text-lg">This may take a few moments. Please wait.</p>
                  <a
                    href="/"
                    className="mt-8 inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-base font-medium text-white hover:bg-white/10 transition"
                  >
                    ← Back to Home
                  </a>
                </div>
              )}

              {/* ERROR RESULT */}
              {result && !result.success && (
                <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md p-8 md:p-10 shadow-2xl shadow-black/30">
                  <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/60">
                    Error
                  </div>

                  <h1 className="mt-6 text-3xl md:text-4xl font-semibold tracking-tight">
                    Something went wrong.
                  </h1>

                  <p className="mt-6 text-lg text-white/72 leading-relaxed">
                    {result.error || "An unexpected error occurred. Please try again."}
                  </p>

                  <a
                    href="/"
                    className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-base font-medium text-white hover:bg-white/10 transition mt-6"
                  >
                    ← Back to Home
                  </a>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

/* ── Intro Screen ── */

function IntroScreen({ fullName, setFullName, email, setEmail, selectedOffer, setSelectedOffer, promoCode, setPromoCode, promoValidated, validatePromoCode, onStart, checkoutLoading }) {
  // DEBUG: Immediate render log
  const isButtonDisabled = !fullName.trim() || !email.trim() || (!promoValidated && !selectedOffer) || checkoutLoading
  console.log("[INTROSCREEN RENDER]", {
    hasOnStart: !!onStart,
    onStartType: typeof onStart,
    selectedOffer,
    promoValidated,
    fullNameTrimmed: fullName.trim(),
    emailTrimmed: email.trim(),
    isButtonDisabled,
    checkoutLoading,
  })

  // DEBUG: Verify button handler is wired
  useEffect(() => {
    console.log("[INTROSCREEN MOUNTED]", {
      onStart: typeof onStart,
      selectedOffer,
      promoValidated,
      checkoutLoading,
    })
  }, [onStart, selectedOffer, promoValidated, checkoutLoading])

  return (
    <div className="space-y-10">
      <a
        href="/"
        className="inline-flex items-center text-sm text-white/60 hover:text-white transition"
      >
        ← Back to Home
      </a>

      <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md p-8 md:p-10 shadow-2xl shadow-black/30">
        <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/60">
          MORE MindMap Profile
        </div>

        <h1 className="mt-6 text-4xl md:text-5xl leading-[0.98] font-semibold tracking-tight">
          Build Your MORE MindMap Profile
        </h1>

        <p className="mt-6 text-lg md:text-xl text-white/72 leading-relaxed max-w-3xl">
          Understand how you think, communicate, decide, and operate. Get a sharper picture of your
          strengths, blind spots, and working style.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6">
            <div className="text-xs uppercase tracking-[0.22em] text-white/45">What this is</div>
            <div className="mt-4 space-y-4 text-white/70 leading-8">
              <p>
                This is not a generic personality quiz. It is a behavioral mapping tool designed to
                identify how you actually move through decisions, pressure, leadership, and
                relationships.
              </p>
              <p>
                You will be given 24 scenario-based questions designed to reveal how you actually operate under pressure. Most people complete it in 5–7 minutes.
              </p>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6">
            <div className="text-xs uppercase tracking-[0.22em] text-white/45">What you receive</div>
            <div className="mt-4 space-y-4 text-white/70 leading-8">
              <p>
                After completing the assessment, your responses are scored across 8 behavioral
                dimensions and interpreted into a personalized profile.
              </p>
              <p>
                You will see your primary and secondary patterns, a percentage breakdown, and an
                interpretation of how you operate.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Promo Code Section */}
      {!promoValidated && (
        <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md p-8">
          <div className="text-xs uppercase tracking-[0.22em] text-white/45">Have a Promo Code?</div>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Enter promo code"
              className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5 text-white placeholder:text-white/30 outline-none focus:border-white/25 uppercase"
            />
            <button
              onClick={validatePromoCode}
              disabled={!promoCode.trim()}
              className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-medium text-white hover:bg-white/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Validate
            </button>
          </div>
        </div>
      )}

      {promoValidated && (
        <div className="rounded-[2rem] border border-green-500/30 bg-green-500/10 backdrop-blur-md p-8">
          <div className="flex items-center gap-3">
            <div className="text-2xl">✓</div>
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-green-400">Promo Code Active</div>
              <div className="mt-1 text-white">FATHOMFREE — Full Profile unlocked</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md p-8">
          <div className="text-xs uppercase tracking-[0.22em] text-white/45">Pricing</div>

          <div className="mt-6 grid gap-4">
            <button
              onClick={() => setSelectedOffer("mini_profile")}
              className={[
                "text-left rounded-[1.25rem] border bg-white/[0.04] p-5 transition duration-200",
                selectedOffer === "mini_profile"
                  ? "border-white/40 bg-white/[0.12]"
                  : "border-white/10 hover:bg-white/[0.06] hover:border-white/20",
              ].join(" ")}
            >
              <div className="text-sm text-white/50">Mini Profile</div>
              <div className="mt-2 text-3xl font-semibold">$9.99</div>
              <p className="mt-3 text-white/65 leading-7">
                A tight summary of your personality profile and communication map.
              </p>
            </button>

            <button
              onClick={() => setSelectedOffer("mini_review")}
              className={[
                "text-left rounded-[1.25rem] border bg-white/[0.04] p-5 transition duration-200",
                selectedOffer === "mini_review"
                  ? "border-white/40 bg-white/[0.12]"
                  : "border-white/10 hover:bg-white/[0.06] hover:border-white/20",
              ].join(" ")}
            >
              <div className="text-sm text-white/50">Mini Profile + 30-min Assessment Review</div>
              <div className="mt-2 text-3xl font-semibold">$58.99</div>
              <p className="mt-3 text-white/65 leading-7">
                Mini Profile with personalized 30-minute assessment review call.
              </p>
            </button>

            <button
              onClick={() => setSelectedOffer("full_profile")}
              className={[
                "text-left rounded-[1.25rem] border bg-white/[0.04] p-5 transition duration-200",
                selectedOffer === "full_profile"
                  ? "border-white/40 bg-white/[0.12]"
                  : "border-white/10 hover:bg-white/[0.06] hover:border-white/20",
              ].join(" ")}
            >
              <div className="text-sm text-white/50">Full Profile</div>
              <div className="mt-2 text-3xl font-semibold">$19.99</div>
              <p className="mt-3 text-white/65 leading-7">
                Full personality + leadership + communication map with detailed interpretation.
              </p>
            </button>

            <button
              onClick={() => setSelectedOffer("full_review")}
              className={[
                "text-left rounded-[1.25rem] border bg-white/[0.04] p-5 transition duration-200",
                selectedOffer === "full_review"
                  ? "border-white/40 bg-white/[0.12]"
                  : "border-white/10 hover:bg-white/[0.06] hover:border-white/20",
              ].join(" ")}
            >
              <div className="text-sm text-white/50">Full Profile + 40-min Assessment Review</div>
              <div className="mt-2 text-3xl font-semibold">$88.99</div>
              <p className="mt-3 text-white/65 leading-7">
                Full Profile with personalized 40-minute assessment review call.
              </p>
            </button>

            <button
              onClick={() => setSelectedOffer("full_coaching")}
              className={[
                "text-left rounded-[1.25rem] border bg-white/[0.04] p-5 transition duration-200",
                selectedOffer === "full_coaching"
                  ? "border-white/40 bg-white/[0.12]"
                  : "border-white/10 hover:bg-white/[0.06] hover:border-white/20",
              ].join(" ")}
            >
              <div className="text-sm text-white/50">Full Profile + Full Coaching Package</div>
              <div className="mt-2 text-3xl font-semibold">Price Upon Request</div>
              <p className="mt-3 text-white/65 leading-7">
                Includes Full Profile and full-time coaching built around your profile and growth plan.{' '}
                <a 
                  href="https://calendly.com/darren" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-white hover:text-white/80 underline transition"
                  onClick={(e) => e.stopPropagation()}
                >
                  Schedule a call with Darren
                </a>
                {' '}to discuss coaching options.
              </p>
            </button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md p-8">
          <div className="text-xs uppercase tracking-[0.22em] text-white/45">Get started</div>

          <div className="mt-6 space-y-5">
            <label className="block">
              <div className="mb-2 text-sm text-white/60">Your Name</div>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5 text-white placeholder:text-white/30 outline-none focus:border-white/25"
              />
            </label>
            <label className="block">
              <div className="mb-2 text-sm text-white/60">Email</div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5 text-white placeholder:text-white/30 outline-none focus:border-white/25"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={(e) => {
              console.log("[BUTTON CLICKED DIRECTLY]", e, onStart)
              onStart()
            }}
            disabled={!fullName.trim() || !email.trim() || (!promoValidated && !selectedOffer) || checkoutLoading}
            className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-white text-black px-6 py-4 text-base font-medium hover:bg-white/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {checkoutLoading ? "Redirecting to checkout..." : promoValidated ? "Start Assessment (Promo Active)" : "Start Assessment"}
          </button>

          {!promoValidated && !selectedOffer && fullName.trim() && email.trim() && (
            <div className="mt-4 p-4 rounded-xl border border-white/20 bg-white/[0.08]">
              <p className="text-sm text-white/70">
                <span className="font-medium">⚠ Select a pricing option above</span> to continue to checkout.
              </p>
            </div>
          )}

          <p className="mt-4 text-sm text-white/45 leading-6">
            24 scenario-based questions designed to reveal how you actually operate under pressure. Most people complete it in 5–7 minutes.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Question Screen ── */

function QuestionScreen({
  step,
  total,
  progress,
  question,
  selectedKey,
  onSelect,
  onNext,
  onBack,
  isFirst,
  isLast,
}) {
  // Determine question type and handle accordingly
  const questionType = question.type
  const hasAnswers = question.answers && question.answers.length > 0
  const answerOptions = question.answers || question.options || []

  // Determine if answer is complete for this type
  let isAnswered = false
  if (questionType === "single_choice") {
    isAnswered = !!selectedKey
  } else if (questionType === "choose_two") {
    isAnswered = Array.isArray(selectedKey) && selectedKey.length === 2
  } else if (questionType === "ranking") {
    isAnswered = Array.isArray(selectedKey) && selectedKey.length === answerOptions.length
  } else if (questionType === "written_response") {
    isAnswered = selectedKey && typeof selectedKey === "string" && selectedKey.trim().length > 0
  }

  return (
    <div className="space-y-8">
      <a
        href="/"
        className="inline-flex items-center text-sm text-white/60 hover:text-white transition"
      >
        ← Back to Home
      </a>

      <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md p-8 md:p-10 shadow-2xl shadow-black/30">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/45">Assessment in progress</div>
            <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight">
              Question {step + 1} of {total}
            </h1>
          </div>
          <div className="text-sm text-white/55">{progress}% complete</div>
        </div>

        <div className="mt-6 h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-white transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-10">
          <h2 className="text-lg md:text-xl font-medium leading-relaxed max-w-3xl">
            {question.question || question.prompt}
          </h2>

          <div className="mt-6">
            {/* SINGLE CHOICE */}
            {questionType === "single_choice" && hasAnswers && (
              <div className="space-y-3">
                {answerOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => onSelect(opt.key)}
                    className={[
                      "w-full text-left rounded-[1.25rem] border px-5 py-4 transition duration-200",
                      selectedKey === opt.key
                        ? "border-white/40 bg-white/[0.12] text-white"
                        : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:border-white/20",
                    ].join(" ")}
                  >
                    <span className="text-white/40 font-medium mr-3">{opt.key}.</span>
                    {opt.text}
                  </button>
                ))}
              </div>
            )}

            {/* CHOOSE TWO */}
            {questionType === "choose_two" && hasAnswers && (
              <div className="space-y-3">
                <p className="text-sm text-white/50 mb-4">Select exactly 2 options</p>
                {answerOptions.map((opt) => {
                  const isSelected = Array.isArray(selectedKey) && selectedKey.includes(opt.key)
                  return (
                    <button
                      key={opt.key}
                      onClick={() => {
                        const current = Array.isArray(selectedKey) ? [...selectedKey] : []
                        if (current.includes(opt.key)) {
                          onSelect(current.filter((k) => k !== opt.key))
                        } else if (current.length < 2) {
                          onSelect([...current, opt.key])
                        }
                      }}
                      className={[
                        "w-full text-left rounded-[1.25rem] border px-5 py-4 transition duration-200",
                        isSelected
                          ? "border-white/40 bg-white/[0.12] text-white"
                          : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:border-white/20",
                      ].join(" ")}
                    >
                      <span className="text-white/40 font-medium mr-3">{opt.key}.</span>
                      {opt.text}
                    </button>
                  )
                })}
              </div>
            )}

            {/* RANKING */}
            {questionType === "ranking" && hasAnswers && (
              <div className="space-y-3">
                <p className="text-sm text-white/50 mb-4">Click in order (1st, 2nd, 3rd, 4th)</p>
                {!Array.isArray(selectedKey) ? (
                  answerOptions.map((opt, idx) => (
                    <button
                      key={opt.key}
                      onClick={() => onSelect([opt.key])}
                      className="w-full text-left rounded-[1.25rem] border border-white/10 bg-white/[0.03] px-5 py-4 text-white/70 hover:bg-white/[0.06] hover:border-white/20 transition duration-200"
                    >
                      <span className="text-white/40 font-medium mr-3">{opt.key}.</span>
                      {opt.text}
                    </button>
                  ))
                ) : (
                  <div className="space-y-3">
                    {selectedKey.map((key, rank) => {
                      const opt = answerOptions.find((o) => o.key === key)
                      return (
                        <div
                          key={key}
                          className="w-full rounded-[1.25rem] border border-white/40 bg-white/[0.12] px-5 py-4 text-white flex justify-between items-center"
                        >
                          <span>
                            <span className="text-white/40 font-medium mr-3">{rank + 1}.</span>
                            {opt?.text}
                          </span>
                          <button
                            onClick={() => {
                              const updated = selectedKey.filter((k) => k !== key)
                              onSelect(updated.length > 0 ? updated : null)
                            }}
                            className="text-white/50 hover:text-white transition"
                          >
                            ✕
                          </button>
                        </div>
                      )
                    })}
                    {selectedKey.length < answerOptions.length && (
                      <div className="space-y-2">
                        <p className="text-xs text-white/40 mt-4">Remaining options:</p>
                        {answerOptions
                          .filter((o) => !selectedKey.includes(o.key))
                          .map((opt) => (
                            <button
                              key={opt.key}
                              onClick={() => onSelect([...selectedKey, opt.key])}
                              className="w-full text-left rounded-[1.25rem] border border-white/10 bg-white/[0.03] px-5 py-4 text-white/70 hover:bg-white/[0.06] hover:border-white/20 transition duration-200"
                            >
                              <span className="text-white/40 font-medium mr-3">{opt.key}.</span>
                              {opt.text}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* WRITTEN RESPONSE */}
            {questionType === "written_response" && (
              <textarea
                value={selectedKey || ""}
                onChange={(e) => onSelect(e.target.value)}
                placeholder="Write your response here... (min. 10 characters)"
                className="w-full rounded-[1.25rem] border border-white/10 bg-black/40 px-5 py-4 text-white placeholder:text-white/30 outline-none focus:border-white/25 resize-none"
                rows={6}
              />
            )}

            {/* FALLBACK: No question type matched */}
            {!["single_choice", "choose_two", "ranking", "written_response"].includes(questionType) && (
              <div className="rounded-[1rem] border border-white/10 bg-white/[0.05] px-4 py-3 text-white/60 text-sm">
                Unable to render question type: {questionType}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-4 sm:justify-between">
          <button
            onClick={onBack}
            disabled={isFirst}
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-medium text-white hover:bg-white/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Back
          </button>

          <button
            onClick={onNext}
            disabled={!isAnswered}
            className="inline-flex items-center justify-center rounded-2xl bg-white text-black px-6 py-3.5 text-sm font-medium hover:bg-white/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLast ? "Submit Assessment" : "Next Question"}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Processing Screen ── */

function ProcessingScreen() {
  const [messageIndex, setMessageIndex] = useState(0)
  
  const messages = [
    "Analyzing behavioral patterns…",
    "Mapping decision structure…",
    "Detecting communication signals…",
    "Evaluating relational awareness…",
    "Generating profile…"
  ]
  
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length)
    }, 400)
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md p-12 md:p-16 shadow-2xl shadow-black/30">
      <div className="flex flex-col items-center justify-center space-y-8">
        <div className="space-y-2">
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-center">
            {messages[messageIndex]}
          </h2>
          <p className="text-white/40 text-sm text-center">
            This analysis is unique to you.
          </p>
        </div>
        
        <div className="flex gap-2">
          <div className="h-2 w-2 rounded-full bg-white/60 animate-pulse" style={{ animation: 'pulse 1s ease-in-out infinite' }} />
          <div className="h-2 w-2 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: '0.2s' }} />
          <div className="h-2 w-2 rounded-full bg-white/20 animate-pulse" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    </div>
  )
}

/* ── Loading Dots ── */

function LoadingDots() {
  return (
    <div className="flex gap-2">
      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-3 w-3 rounded-full bg-white"
          style={{ animation: `dotPulse 1.4s ease-in-out ${i * 0.16}s infinite` }}
        />
      ))}
    </div>
  )
}

/* ── Background ── */

function ProfileBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes driftSlow {
          0% { transform: translate3d(-2%, 0, 0) scaleX(1.02); }
          50% { transform: translate3d(2%, 0, 0) scaleX(0.99); }
          100% { transform: translate3d(-2%, 0, 0) scaleX(1.02); }
        }
        @keyframes glowPulse {
          0% { opacity: 0.08; }
          50% { opacity: 0.16; }
          100% { opacity: 0.08; }
        }
      `}</style>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.07),transparent_24%),radial-gradient(circle_at_82%_70%,rgba(255,255,255,0.05),transparent_28%)]" />

      <svg
        viewBox="0 0 1600 900"
        className="absolute inset-x-[-10%] bottom-[-5%] h-[55%] w-[120%] opacity-50"
        preserveAspectRatio="none"
        style={{ animation: 'driftSlow 20s ease-in-out infinite' }}
      >
        <defs>
          <linearGradient id="profileWave" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="24%" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="76%" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        {Array.from({ length: 18 }).map((_, i) => (
          <path
            key={i}
            d={`M -100 ${440 + i * 11} C 170 ${560 - i * 3}, 420 ${285 + i * 5}, 740 ${398 + i * 1} S 1220 ${560 - i * 4}, 1710 ${390 + i * 2}`}
            stroke="url(#profileWave)"
            strokeWidth={1.05}
            strokeOpacity={0.95 - i * 0.04}
            fill="none"
          />
        ))}
      </svg>

      <div
        className="absolute left-[16%] top-[18%] h-40 w-40 rounded-full bg-white blur-[110px]"
        style={{ animation: 'glowPulse 8s ease-in-out infinite' }}
      />
      <div
        className="absolute right-[12%] bottom-[18%] h-56 w-56 rounded-full bg-white blur-[150px]"
        style={{ animation: 'glowPulse 10s ease-in-out infinite' }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/15 to-black/65" />
    </div>
  )
}
