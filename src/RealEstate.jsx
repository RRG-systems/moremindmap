import { useMemo, useState } from 'react'

const QUESTIONS = [
  "1.) Do you have enough leads to achieve your goals?",
  "2.) What are your business goals?",
  "3.) How many people do you have in your MET Database?",
  "4.) If I asked you to lead generate today and meet 3 new people, what would you do?",
  "5.) Rate yourself on a scale of 1–10 on each: quality of your database, whether you feed it daily, whether you have systems for consistent contact, and whether you are able to service all leads.",
  "6.) What sources of lead generation are you willing to do? You can pick up to 4.",
  "7.) If we take your goals from question 2 and triple them, how do you feel?",
  "8.) What is more important to you: time or money?",
  "9.) If you made an extra $10K+ a month, what would you do with the money?",
  "10.) On a scale from 1–10, rank yourself as a leader. Specifically, why did you choose that number?",
  "11.) Do you have a P&L? If yes, what percentage do you spend on marketing? What bottom-line percentage do you keep for yourself?",
  "12.) Do you have a corporation?",
  "13.) Who is helping hold you accountable to a plan?",
  "14.) Do you business plan every year? Have you hit or missed your business plan in the last 5 years? Be specific.",
  "15.) What do you plan on doing after real estate? Passive income?",
  "16.) How do you feel after answering these questions?"
]

const FATHOM_CODE = "FATHOMFREE"

export default function RealEstate() {
  const [started, setStarted] = useState(false)
  const [step, setStep] = useState(0)
  const [promoCode, setPromoCode] = useState("")
  const [agentName, setAgentName] = useState("")
  const [agentEmail, setAgentEmail] = useState("")
  const [agentPhone, setAgentPhone] = useState("")
  const [answers, setAnswers] = useState(Array(QUESTIONS.length).fill(""))
  const [submitted, setSubmitted] = useState(false)

  const hasFathomCode = useMemo(
    () => promoCode.trim().toUpperCase() === FATHOM_CODE,
    [promoCode]
  )

  const progress = Math.round(((step + 1) / QUESTIONS.length) * 100)

  function updateAnswer(value) {
    const next = [...answers]
    next[step] = value
    setAnswers(next)
  }

  async function submitAnswers() {
    try {
      const API = import.meta.env.VITE_API_URL || "http://localhost:4242"
      const res = await fetch(`${API}/submit/real-estate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: agentName,
          email: agentEmail,
          phone: agentPhone,
          promoCode,
          answers,
          questions: QUESTIONS,
        }),
      })
      const data = await res.json()
      if (data.success) {
        console.log("Real estate assessment submitted successfully:", data.filename)
      } else {
        console.error("Real estate submission failed:", data.error)
      }
    } catch (error) {
      console.error("Real estate submission error:", error)
    }
    setSubmitted(true)
  }

  function goNext() {
    if (!answers[step].trim()) return
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1)
    } else {
      submitAnswers()
    }
  }

  function goBack() {
    if (step > 0) setStep(step - 1)
  }

  function restartAssessment() {
    setStarted(false)
    setStep(0)
    setAnswers(Array(QUESTIONS.length).fill(""))
    setSubmitted(false)
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <SubtleBackground />

      <div className="relative z-10 px-6 py-16 md:py-20">
        <div className="max-w-4xl mx-auto">
          {!started && !submitted && (
            <IntroScreen
              agentName={agentName}
              setAgentName={setAgentName}
              agentEmail={agentEmail}
              setAgentEmail={setAgentEmail}
              agentPhone={agentPhone}
              setAgentPhone={setAgentPhone}
              promoCode={promoCode}
              setPromoCode={setPromoCode}
              hasFathomCode={hasFathomCode}
              onStart={() => setStarted(true)}
            />
          )}

          {started && !submitted && (
            <QuestionScreen
              step={step}
              progress={progress}
              question={QUESTIONS[step]}
              answer={answers[step]}
              onChange={updateAnswer}
              onNext={goNext}
              onBack={goBack}
              isFirst={step === 0}
              isLast={step === QUESTIONS.length - 1}
            />
          )}

          {submitted && (
            <CompletionScreen
              agentName={agentName}
              agentEmail={agentEmail}
              hasFathomCode={hasFathomCode}
              promoCode={promoCode}
              onRestart={restartAssessment}
              answers={answers}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function IntroScreen({
  agentName,
  setAgentName,
  agentEmail,
  setAgentEmail,
  agentPhone,
  setAgentPhone,
  promoCode,
  setPromoCode,
  onStart
}) {
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
          Real Estate Assessment
        </div>

        <h1 className="mt-6 text-4xl md:text-5xl leading-[0.98] font-semibold tracking-tight">
          Assess Your Real Estate Business
        </h1>

        <p className="mt-6 text-lg md:text-xl text-white/72 leading-relaxed max-w-3xl">
          Get a clear diagnosis of your business, your database, and your next stage of growth.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6">
            <div className="text-xs uppercase tracking-[0.22em] text-white/45">What this is</div>
            <div className="mt-4 space-y-4 text-white/70 leading-8">
              <p>
                This is not a generic quiz or a motivational worksheet. This is a strategic
                business assessment designed to help real estate agents understand where they are,
                what is holding them back, and what needs to happen next.
              </p>
              <p>
                You will be asked a series of questions about your business, your database, your
                lead generation, your systems, your goals, and the way you currently operate.
              </p>
              <p>
                The more honest and detailed you are, the more accurate and useful your assessment
                will be.
              </p>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6">
            <div className="text-xs uppercase tracking-[0.22em] text-white/45">What you receive</div>
            <div className="mt-4 space-y-4 text-white/70 leading-8">
              <p>
                After you complete the assessment, your answers are used to generate a personalized
                business assessment based on your current structure, database strength, growth goals,
                and likely bottlenecks.
              </p>
              <p>
                This is designed to help identify your current business state, whether your database
                is actually supporting your goals, where your business is underbuilt, and what needs
                to change first, second, and third.
              </p>
              <p>
                This is the starting point for real clarity, not guesswork.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6">
          <div className="text-xs uppercase tracking-[0.22em] text-white/45">Before you start</div>
          <div className="mt-4 grid gap-3 text-white/68 leading-7">
            <p>Be honest.</p>
            <p>Be specific.</p>
            <p>Do not try to give the best sounding answer.</p>
            <p>Do not shorten your answers just to get through it faster.</p>
            <p>If something is broken, say it is broken.</p>
            <p>If your database is messy, stale, or scattered, say that clearly.</p>
            <p>If you are frustrated, behind, rebuilding, or unsure, say that too.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md p-8">
          <div className="text-xs uppercase tracking-[0.22em] text-white/45">Pricing</div>

          <div className="mt-6 grid gap-4">
            <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm text-white/50">Assessment</div>
              <div className="mt-2 text-3xl font-semibold">$59</div>
              <p className="mt-3 text-white/65 leading-7">
                Full personalized business assessment based on your answers, bottlenecks, database
                structure, and likely next priorities.
              </p>
            </div>

            <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm text-white/50">Coaching</div>
              <div className="mt-2 text-3xl font-semibold">
                $199<span className="text-base text-white/50">/mo</span>
              </div>
              <p className="mt-3 text-white/65 leading-7">
                Two months of coaching to help move from diagnosis into action, structure, and
                implementation.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md p-8">
          <div className="text-xs uppercase tracking-[0.22em] text-white/45">Get started</div>

          <div className="mt-6 space-y-5">
            <Input
              label="Your Name"
              value={agentName}
              onChange={setAgentName}
              placeholder="Enter your full name"
            />
            <Input
              label="Email"
              value={agentEmail}
              onChange={setAgentEmail}
              placeholder="Enter your email"
            />
            <Input
              label="Phone (optional)"
              value={agentPhone}
              onChange={setAgentPhone}
              placeholder="Enter your phone number"
            />
            <Input
              label="Promo Code (optional)"
              value={promoCode}
              onChange={setPromoCode}
              placeholder="Enter code if you have one"
            />
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-sm text-white/45 leading-6">
              If you have a promo code, enter it above.
            </p>
          </div>

          <button
            onClick={onStart}
            disabled={!agentName.trim() || !agentEmail.trim()}
            className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-white text-black px-6 py-4 text-base font-medium hover:bg-white/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Start Assessment
          </button>

          <p className="mt-4 text-sm text-white/45 leading-6">
            You will answer the questions one at a time. Be as detailed as you can. Do not worry
            about perfect wording. Just talk.
          </p>
        </div>
      </div>
    </div>
  )
}

function QuestionScreen({
  step,
  progress,
  question,
  answer,
  onChange,
  onNext,
  onBack,
  isFirst,
  isLast
}) {
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
              Question {step + 1} of {QUESTIONS.length}
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
          <h2 className="text-xl md:text-2xl font-medium leading-relaxed max-w-3xl">
            {question}
          </h2>

          <textarea
            value={answer}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Answer in as much detail as you can. Do not worry about perfect spelling. Just explain clearly and honestly."
            className="mt-6 w-full min-h-[240px] rounded-[1.25rem] border border-white/10 bg-black/40 px-5 py-4 text-white placeholder:text-white/30 outline-none focus:border-white/25 resize-y"
          />

          <p className="mt-4 text-sm text-white/45 leading-6">
            The better the answer, the better the diagnosis. Honest and messy is more useful than polished and vague.
          </p>
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
            disabled={!answer.trim()}
            className="inline-flex items-center justify-center rounded-2xl bg-white text-black px-6 py-3.5 text-sm font-medium hover:bg-white/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLast ? "Finish Assessment" : "Next Question"}
          </button>
        </div>
      </div>
    </div>
  )
}

function CompletionScreen({ agentName, agentEmail, hasFathomCode, promoCode, onRestart, answers }) {
  return (
    <div className="space-y-8">
      <a
        href="/"
        className="inline-flex items-center text-sm text-white/60 hover:text-white transition"
      >
        ← Back to Home
      </a>

      <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md p-8 md:p-10 shadow-2xl shadow-black/30">
        <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/60">
          Assessment Complete
        </div>

        <h1 className="mt-6 text-4xl md:text-5xl font-semibold tracking-tight">
          Good. Now the real part starts.
        </h1>

        <p className="mt-6 text-lg text-white/72 leading-relaxed max-w-3xl">
          Your answers are complete. This is where your personalized assessment gets generated,
          reviewed, and turned into a real strategy conversation.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6">
            <div className="text-xs uppercase tracking-[0.22em] text-white/45">Status</div>
            <div className="mt-4 space-y-4 text-white/70 leading-8">
              <p><span className="text-white/90 font-medium">Agent:</span> {agentName || "Not provided"}</p>
              <p><span className="text-white/90 font-medium">Email:</span> {agentEmail || "Not provided"}</p>
              <p><span className="text-white/90 font-medium">Questions answered:</span> {answers.filter(Boolean).length} / {QUESTIONS.length}</p>
              {hasFathomCode ? (
                <p>
                  <span className="text-white/90 font-medium">Offer applied:</span> Free assessment + 1 month coaching
                </p>
              ) : (
                <p>
                  <span className="text-white/90 font-medium">Standard path:</span> $59 assessment + optional coaching
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6">
            <div className="text-xs uppercase tracking-[0.22em] text-white/45">What happens next</div>
            <div className="mt-4 space-y-4 text-white/70 leading-8">
              <p>Your assessment gets reviewed and turned into a personalized business diagnosis.</p>
              <p>You then book your review session and receive your assessment directly in context.</p>
              <p>The point is not just to hand you a PDF. The point is to make sure you understand what it actually means.</p>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <a
            href="https://calendly.com/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-2xl bg-white text-black px-6 py-4 text-base font-medium hover:bg-white/90 transition"
          >
            Book Your Assessment Review
          </a>

          <a
            href="#"
            className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-base font-medium text-white hover:bg-white/10 transition"
          >
            Continue to Payment / Checkout
          </a>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-sm text-white/50 leading-6">
            Current build note: Stripe, Formspree submission, PDF generation, and your real Calendly link
            still need to be wired in. Promo code entered:{" "}
            <span className="text-white/70">{promoCode || "none"}</span>
          </p>
        </div>

        <button
          onClick={onRestart}
          className="mt-8 inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-medium text-white hover:bg-white/10 transition"
        >
          Start Over
        </button>
      </div>
    </div>
  )
}

function Input({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm text-white/60">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5 text-white placeholder:text-white/30 outline-none focus:border-white/25"
      />
    </label>
  )
}

function SubtleBackground() {
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
          <linearGradient id="pageWave" x1="0" y1="0" x2="1" y2="0">
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
            stroke="url(#pageWave)"
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
