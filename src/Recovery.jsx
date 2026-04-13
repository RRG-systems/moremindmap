export default function Recovery() {
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <RecoveryBackground />

      <div className="relative z-10 px-6 py-16 md:py-20">
        <div className="max-w-4xl mx-auto space-y-10">

          <a
            href="/"
            className="inline-flex items-center text-sm text-white/60 hover:text-white transition"
          >
            ← Back to Home
          </a>

          {/* HERO */}
          <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md p-8 md:p-10 shadow-2xl shadow-black/30">
            <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/60">
              Revenue Recovery
            </div>

            <h1 className="mt-6 text-4xl md:text-5xl leading-[0.98] font-semibold tracking-tight">
              Recover the revenue already sitting in your database.
            </h1>

            <p className="mt-6 text-lg md:text-xl text-white/72 leading-relaxed max-w-3xl">
              Most businesses don’t have a lead problem. They have a follow-up, classification, and timing problem.
            </p>
          </div>

          {/* REALITY SECTION */}
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-7 md:p-8">
            <h2 className="text-xl font-semibold tracking-tight">
              Your database is not a list.
            </h2>

            <div className="mt-5 space-y-4 text-white/70 leading-8">
              <p>
                It’s a collection of incomplete conversations, missed timing windows, and unconverted intent.
              </p>
              <p>
                Every lead you’ve ever generated exists on a timeline. Some were too early. Some were ignored. Some were never followed up properly.
              </p>
              <p>
                Over time, that data decays.
              </p>
              <p>
                But it doesn’t disappear.
              </p>
            </div>
          </div>

          {/* WHAT RRG IS */}
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-7 md:p-8">
            <h2 className="text-xl font-semibold tracking-tight">
              What Revenue Recovery Group does
            </h2>

            <div className="mt-5 space-y-4 text-white/70 leading-8">
              <p>
                Revenue Recovery Group is built to identify, re-engage, and convert missed opportunities inside existing databases.
              </p>
              <p>
                This is not lead generation.
              </p>
              <p>
                This is recovery.
              </p>
            </div>
          </div>

          {/* SYSTEM SECTION */}
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-7 md:p-8">
            <h2 className="text-xl font-semibold tracking-tight">
              How the system works
            </h2>

            <div className="mt-5 space-y-4 text-white/70 leading-8">
              <p>
                Once your database is exported and a few key inputs are provided, we begin evaluating its recoverability.
              </p>

              <ul className="space-y-2 text-white/65">
                <li>• lead age and decay patterns</li>
                <li>• source quality and intent strength</li>
                <li>• gaps in follow-up</li>
                <li>• contact density and relationship depth</li>
                <li>• signals of near-term conversion potential</li>
              </ul>

              <p>
                This process feeds into what we call a <span className="text-white/90">Lifecycle Detection Engine</span> — a structured approach to identifying where each contact actually sits in its decision cycle, and where reactivation is most likely to occur.
              </p>

              <p>
                From there, an initial recovery profile is created, moving toward an AI-assisted recoverability score that highlights where effort should be applied first.
              </p>
            </div>
          </div>

          {/* WHAT TO DO */}
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-7 md:p-8">
            <h2 className="text-xl font-semibold tracking-tight">
              What to do next
            </h2>

            <div className="mt-5 space-y-4 text-white/70 leading-8">
              <p>1. Export your database from your CRM</p>
              <p>2. Do not clean it</p>
              <p>3. Do not organize it</p>
              <p>4. Bring it exactly as it is</p>
            </div>
          </div>

          {/* CTA */}
          <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md p-8 text-center">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Schedule Your Recovery Call
            </h2>

            <p className="mt-4 text-white/65 leading-7 max-w-2xl mx-auto">
              We’ll review your database, identify where the real opportunities are, and map out what recovery actually looks like.
            </p>

            <a
              href="https://calendly.com/morerevshare/info"
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex items-center justify-center rounded-2xl bg-white text-black px-8 py-4 text-base font-medium hover:bg-white/90 transition"
            >
              Book Recovery Call
            </a>
          </div>

        </div>
      </div>
    </div>
  )
}

function RecoveryBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes driftSlow {
          0% { transform: translate3d(-2%, 0, 0); }
          50% { transform: translate3d(2%, 0, 0); }
          100% { transform: translate3d(-2%, 0, 0); }
        }
      `}</style>

      <svg
        viewBox="0 0 1600 900"
        className="absolute inset-x-[-10%] bottom-[-5%] h-[55%] w-[120%] opacity-50"
        preserveAspectRatio="none"
        style={{ animation: 'driftSlow 20s ease-in-out infinite' }}
      >
        <defs>
          <linearGradient id="rrgWave" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.8)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        {Array.from({ length: 16 }).map((_, i) => (
          <path
            key={i}
            d={`M -100 ${440 + i * 12} C 200 ${550 - i * 3}, 500 ${300 + i * 4}, 900 ${400} S 1400 ${500}, 1700 ${400}`}
            stroke="url(#rrgWave)"
            strokeWidth={1}
            fill="none"
            opacity={0.9 - i * 0.05}
          />
        ))}
      </svg>

      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/15 to-black/65" />
    </div>
  )
}
