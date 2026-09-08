import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const JOURNEY_DETAILS = Object.freeze({
  self: Object.freeze({
    eyebrow: 'MORE ATHLETE PREVIEW',
    title: 'KNOW YOURSELF',
    body: 'This review surface shows where a future Athlete self-understanding experience can begin. It is not connected to a live assessment, account, or payment flow.',
  }),
  sport: Object.freeze({
    eyebrow: 'MORE ATHLETE PREVIEW',
    title: 'YOUR SPORT',
    body: 'This review surface shows where a future current-performance review can begin. No Athlete data, score, prediction, or roster decision is being created.',
  }),
  plan: Object.freeze({
    eyebrow: 'MORE ATHLETE PREVIEW',
    title: 'YOUR PLAN COMES ALIVE',
    body: 'This review surface shows where a future continuing Athlete, coach, and MORE relationship can begin. It is not connected to DarrenDemo or a live coaching session.',
  }),
})

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-4 focus-visible:ring-offset-black'
const SHARED_LEADERSHIP_GATE_PATH = '/leadership'
const LEADERSHIP_PILL = 'rounded-full border border-orange-400/35 bg-orange-400/10 px-4 py-2 text-xs font-medium tracking-[0.08em] text-orange-100 shadow-[0_0_28px_rgba(251,146,60,0.12)] transition hover:border-orange-300/60 hover:bg-orange-400/18 hover:text-white'

export default function AthletePublicSiteV1() {
  const { search } = useLocation()
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const [activeJourney, setActiveJourney] = useState(null)
  const dialogCloseRef = useRef(null)
  const accent = useMemo(() => new URLSearchParams(search).get('variant') === 'accent', [search])

  useEffect(() => {
    const previousTitle = document.title
    const existingDescription = document.querySelector('meta[name="description"]')
    const description = existingDescription || document.createElement('meta')
    const previousDescription = existingDescription?.getAttribute('content') || ''

    if (!existingDescription) {
      description.setAttribute('name', 'description')
      document.head.appendChild(description)
    }
    document.title = 'MORE ATHLETE — See the whole athlete'
    description.setAttribute('content', 'Understand who you are, see where your performance is now, and decide what comes next.')

    return () => {
      document.title = previousTitle
      if (existingDescription) description.setAttribute('content', previousDescription)
      else description.remove()
    }
  }, [])

  useEffect(() => {
    if (!activeJourney) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setActiveJourney(null)
    }
    window.addEventListener('keydown', onKeyDown)
    dialogCloseRef.current?.focus()
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeJourney])

  const closeMobileNavigation = () => setMobileNavigationOpen(false)

  return (
    <div id="athlete-top" className="min-h-screen bg-black text-white overflow-hidden relative">
      <AnimatedWaveBackground />

      <header className="relative z-20 border-b border-white/10 bg-black/30 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
          <a href="#athlete-top" className={`text-lg md:text-xl font-semibold tracking-wide ${FOCUS_RING}`}>
            MORE ATHLETE
          </a>
          <nav aria-label="Primary" className="hidden lg:flex items-center gap-4 whitespace-nowrap text-xs text-white/70 xl:gap-8 xl:text-sm">
            <a href="#know-yourself" className={`hover:text-white transition ${FOCUS_RING}`}>KNOW YOURSELF</a>
            <a href="#your-sport" className={`hover:text-white transition ${FOCUS_RING}`}>YOUR SPORT</a>
            <a href="#your-plan" className={`hover:text-white transition ${FOCUS_RING}`}>YOUR PLAN</a>
            <a
              href="#athlete-top"
              aria-label="Return to the top of MORE ATHLETE"
              className={`rounded-full border border-white/15 bg-white/5 px-4 py-2 text-white/80 shadow-[0_0_28px_rgba(255,255,255,0.08)] transition hover:border-white/30 hover:bg-white/10 hover:text-white ${FOCUS_RING}`}
            >
              MORE →
            </a>
            <Link
              to={SHARED_LEADERSHIP_GATE_PATH}
              data-shared-leadership-gate="true"
              className={`${LEADERSHIP_PILL} ${FOCUS_RING}`}
            >
              MORE ATHLETE LEADERSHIP
            </Link>
          </nav>
          <button
            type="button"
            className={`lg:hidden inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-white/80 transition hover:bg-white/10 ${FOCUS_RING}`}
            aria-expanded={mobileNavigationOpen}
            aria-controls="athlete-mobile-navigation"
            onClick={() => setMobileNavigationOpen((open) => !open)}
          >
            {mobileNavigationOpen ? 'CLOSE' : 'MENU'}
          </button>
        </div>
        {mobileNavigationOpen && (
          <nav id="athlete-mobile-navigation" aria-label="Mobile" className="lg:hidden border-t border-white/10 px-6 py-5">
            <div className="mx-auto max-w-7xl flex flex-col gap-4 text-sm text-white/75">
              <a href="#know-yourself" onClick={closeMobileNavigation} className={`py-1 hover:text-white transition ${FOCUS_RING}`}>KNOW YOURSELF</a>
              <a href="#your-sport" onClick={closeMobileNavigation} className={`py-1 hover:text-white transition ${FOCUS_RING}`}>YOUR SPORT</a>
              <a href="#your-plan" onClick={closeMobileNavigation} className={`py-1 hover:text-white transition ${FOCUS_RING}`}>YOUR PLAN</a>
              <a href="#athlete-top" onClick={closeMobileNavigation} className={`py-1 hover:text-white transition ${FOCUS_RING}`}>MORE →</a>
              <Link
                to={SHARED_LEADERSHIP_GATE_PATH}
                onClick={closeMobileNavigation}
                data-shared-leadership-gate="true"
                className={`mt-2 inline-flex w-fit items-center ${LEADERSHIP_PILL} ${FOCUS_RING}`}
              >
                MORE ATHLETE LEADERSHIP
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-7xl px-6 pt-24 pb-20 md:pt-32 md:pb-28">
          <div className="max-w-4xl">
            <div
              data-athlete-accent={accent ? 'true' : 'false'}
              className={[
                'inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/60 backdrop-blur',
                accent ? 'athlete-accent-eyebrow' : '',
              ].join(' ')}
            >
              MORE ATHLETE
            </div>
            <h1 className="mt-8 text-5xl md:text-7xl leading-[0.95] font-semibold tracking-tight max-w-5xl">
              SEE THE WHOLE ATHLETE.
            </h1>
            <p className="mt-6 max-w-3xl text-lg md:text-2xl text-white/72 leading-relaxed">
              Understand who you are. See where your performance is now. Decide what comes next.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <a
                href="#journey"
                className={`inline-flex items-center justify-center rounded-2xl bg-white text-black px-6 py-4 text-base font-medium hover:bg-white/90 transition shadow-[0_0_40px_rgba(255,255,255,0.1)] ${FOCUS_RING}`}
              >
                EXPLORE MORE ATHLETE
              </a>
              <a
                href="#how-it-works"
                className={`inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-base font-medium text-white hover:bg-white/10 transition backdrop-blur ${FOCUS_RING}`}
              >
                HOW IT WORKS
              </a>
            </div>
          </div>
        </section>

        <section id="journey" className="mx-auto max-w-7xl px-6 pb-24 md:pb-28 scroll-mt-8">
          <h2 className="sr-only">The MORE ATHLETE journey</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <PathCard
              id="know-yourself"
              eyebrow="STEP 1"
              title="KNOW YOURSELF"
              description="See how you think, communicate, respond to pressure, recover, and operate—on and beyond the field of play."
              button="KNOW YOURSELF →"
              onAction={() => setActiveJourney('self')}
            />
            <PathCard
              id="your-sport"
              eyebrow="STEP 2"
              title="YOUR SPORT"
              description="See what is happening in your performance now, what appears to matter most, and what the evidence actually supports."
              button="SEE YOUR SPORT CLEARLY →"
              onAction={() => setActiveJourney('sport')}
              featured
              accent={accent}
            />
            <PathCard
              id="your-plan"
              eyebrow="STEP 3"
              title="YOUR PLAN COMES ALIVE"
              description="Athlete, coach, and MORE work from one living understanding of what matters now, what to try next, and what happens after."
              button="SEE HOW YOUR PLAN COMES ALIVE →"
              onAction={() => setActiveJourney('plan')}
            />
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-6 pb-20 scroll-mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-8 items-start">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md p-8 md:p-10 shadow-2xl shadow-black/30">
              <div className="text-xs uppercase tracking-[0.22em] text-white/45">WHAT THIS IS</div>
              <h2 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight">
                ONE ATHLETE. ONE LIVING UNDERSTANDING.
              </h2>
              <div className="mt-5 space-y-5 text-white/72 text-base md:text-lg leading-8">
                <p>Who you are matters.</p>
                <p>What is happening in your sport matters.</p>
                <p>What you and your coach decide next matters.</p>
                <p className="text-white/60">MORE connects those realities without pretending they are the same thing.</p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-md p-8 md:p-10">
              <div className="text-xs uppercase tracking-[0.22em] text-white/45">THE IDEA</div>
              <div className="mt-5 space-y-5 text-white/78 leading-7">
                <IdeaLine title="KNOW YOURSELF" body="Understand how you tend to operate." />
                <IdeaLine title="YOUR SPORT" body="See your current performance reality clearly." />
                <IdeaLine title="YOUR PLAN COMES ALIVE" body="Decide, try, learn, and come back smarter." />
              </div>
            </div>
          </div>
        </section>

        <section id="what-happens-next" className="mx-auto max-w-7xl px-6 pb-28 scroll-mt-8">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 md:p-10 backdrop-blur-md">
            <div className="text-xs uppercase tracking-[0.22em] text-white/45">BUILT TO LEARN WITH YOU</div>
            <h3 className="mt-4 text-2xl md:text-3xl font-semibold tracking-tight max-w-5xl">
              WHAT HAPPENS NEXT BECOMES PART OF THE UNDERSTANDING.
            </h3>
            <p className="mt-5 max-w-4xl text-white/68 text-base md:text-lg leading-8">
              MORE can connect who you are, what is happening in your sport, the goals you are working toward, what you and your coach decide to try, and what actually happens afterward.
            </p>
          </div>
        </section>
      </main>

      {activeJourney && (
        <PrototypeDialog
          detail={JOURNEY_DETAILS[activeJourney]}
          closeRef={dialogCloseRef}
          onClose={() => setActiveJourney(null)}
        />
      )}
    </div>
  )
}

function IdeaLine({ title, body }) {
  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.08em] text-white">{title}</p>
      <p className="mt-1 text-white/62">{body}</p>
    </div>
  )
}

function PathCard({ id, eyebrow, title, description, button, onAction, featured = false, accent = false }) {
  return (
    <article
      id={id}
      data-featured={featured ? 'true' : 'false'}
      data-accent={accent ? 'true' : 'false'}
      className={[
        'group rounded-[2rem] border p-7 md:p-8 backdrop-blur-md transition duration-300 min-h-[320px] flex flex-col justify-between scroll-mt-8',
        featured
          ? 'border-white/20 bg-white/[0.08] shadow-[0_20px_60px_rgba(255,255,255,0.07)]'
          : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.06]',
        accent ? 'athlete-accent-card' : '',
      ].join(' ')}
    >
      <div>
        <div className="text-xs uppercase tracking-[0.22em] text-white/42">{eyebrow}</div>
        <h3 className="mt-5 text-2xl md:text-[1.85rem] leading-tight font-semibold tracking-tight max-w-sm">
          {title}
        </h3>
        <p className="mt-5 text-white/66 text-base leading-7">{description}</p>
      </div>
      <div className="pt-8">
        <button
          type="button"
          onClick={onAction}
          className={`inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/8 px-5 py-3.5 text-sm text-center font-medium text-white transition group-hover:bg-white group-hover:text-black ${FOCUS_RING}`}
        >
          {button}
        </button>
      </div>
    </article>
  )
}

function PrototypeDialog({ detail, closeRef, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="athlete-prototype-dialog-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-xl rounded-[2rem] border border-white/15 bg-black/95 p-8 md:p-10 shadow-[0_30px_100px_rgba(0,0,0,0.9)]">
        <p className="text-xs uppercase tracking-[0.22em] text-white/45">{detail.eyebrow}</p>
        <h2 id="athlete-prototype-dialog-title" className="mt-4 text-3xl font-semibold tracking-tight">{detail.title}</h2>
        <p className="mt-5 text-base leading-8 text-white/68">{detail.body}</p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className={`mt-8 inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3.5 text-sm font-medium text-black transition hover:bg-white/90 ${FOCUS_RING}`}
        >
          RETURN TO THE PAGE
        </button>
      </div>
    </div>
  )
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])

  return reduced
}

function AnimatedWaveBackground() {
  const reducedMotion = useReducedMotion()
  const id = useId().replace(/:/gu, '')
  const softWaveId = `athlete-soft-wave-${id}`
  const brightWaveId = `athlete-bright-wave-${id}`

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes athleteDriftSlow {
          0% { transform: translate3d(-2%, 0, 0) scaleX(1.02); }
          50% { transform: translate3d(2%, 1%, 0) scaleX(0.99); }
          100% { transform: translate3d(-2%, 0, 0) scaleX(1.02); }
        }
        @keyframes athleteDriftFast {
          0% { transform: translate3d(2%, 0, 0) scaleX(1); }
          50% { transform: translate3d(-2%, -1%, 0) scaleX(1.015); }
          100% { transform: translate3d(2%, 0, 0) scaleX(1); }
        }
        @keyframes athleteGlowPulse {
          0% { opacity: 0.08; }
          50% { opacity: 0.18; }
          100% { opacity: 0.08; }
        }
        .athlete-accent-eyebrow {
          border-color: rgba(103, 232, 249, 0.22);
          background: linear-gradient(90deg, rgba(103, 232, 249, 0.10), rgba(167, 139, 250, 0.10));
          color: rgba(255, 255, 255, 0.76);
          box-shadow: 0 0 28px rgba(103, 232, 249, 0.06), 0 0 42px rgba(167, 139, 250, 0.04);
        }
        .athlete-accent-card {
          border-color: rgba(167, 139, 250, 0.28);
          box-shadow: -16px 18px 58px rgba(103, 232, 249, 0.035), 16px 18px 58px rgba(167, 139, 250, 0.055);
        }
      `}</style>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.08),transparent_26%),radial-gradient(circle_at_78%_72%,rgba(255,255,255,0.06),transparent_28%)]" />

      <svg
        viewBox="0 0 1440 820"
        className="absolute inset-x-[-6%] top-[10%] w-[112%] h-[42%] opacity-45"
        preserveAspectRatio="none"
        style={reducedMotion ? undefined : { animation: 'athleteDriftSlow 18s ease-in-out infinite' }}
      >
        <defs>
          <linearGradient id={softWaveId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="30%" stopColor="rgba(255,255,255,0.28)" />
            <stop offset="52%" stopColor="rgba(255,255,255,0.85)" />
            <stop offset="74%" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        <path
          d="M-40 290 C 120 245, 250 335, 420 292 C 610 245, 735 180, 905 228 C 1085 278, 1220 355, 1480 300"
          stroke={`url(#${softWaveId})`}
          strokeWidth="1.2"
          fill="none"
        >
          {!reducedMotion && (
            <animate
              attributeName="d"
              dur="9s"
              repeatCount="indefinite"
              values="M-40 290 C 120 245, 250 335, 420 292 C 610 245, 735 180, 905 228 C 1085 278, 1220 355, 1480 300; M-40 305 C 135 220, 260 300, 430 320 C 610 342, 760 170, 930 220 C 1110 272, 1245 338, 1480 286; M-40 290 C 120 245, 250 335, 420 292 C 610 245, 735 180, 905 228 C 1085 278, 1220 355, 1480 300"
            />
          )}
        </path>

        <path
          d="M-40 322 C 130 280, 270 372, 448 330 C 635 286, 760 218, 930 258 C 1110 300, 1240 380, 1480 330"
          stroke={`url(#${softWaveId})`}
          strokeWidth="1"
          fill="none"
          opacity="0.7"
        >
          {!reducedMotion && (
            <animate
              attributeName="d"
              dur="10.5s"
              repeatCount="indefinite"
              values="M-40 322 C 130 280, 270 372, 448 330 C 635 286, 760 218, 930 258 C 1110 300, 1240 380, 1480 330; M-40 345 C 150 250, 290 345, 460 356 C 648 368, 760 230, 935 252 C 1124 278, 1260 350, 1480 322; M-40 322 C 130 280, 270 372, 448 330 C 635 286, 760 218, 930 258 C 1110 300, 1240 380, 1480 330"
            />
          )}
        </path>
      </svg>

      <svg
        viewBox="0 0 1440 900"
        className="absolute inset-x-[-10%] bottom-[-2%] w-[120%] h-[48%] opacity-70"
        preserveAspectRatio="none"
        style={reducedMotion ? undefined : { animation: 'athleteDriftFast 24s ease-in-out infinite' }}
      >
        <defs>
          <linearGradient id={brightWaveId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="18%" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="48%" stopColor="rgba(255,255,255,0.95)" />
            <stop offset="74%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        {Array.from({ length: 16 }).map((_, index) => (
          <path
            key={index}
            d={`M-80 ${420 + index * 10} C 120 ${560 - index * 4}, 330 ${280 + index * 6}, 560 ${355 + index * 2} C 770 ${425 - index * 2}, 980 ${560 - index * 5}, 1210 ${445 + index * 3} C 1310 ${392 + index * 2}, 1380 ${350 + index * 2}, 1540 ${425 + index * 4}`}
            stroke={`url(#${brightWaveId})`}
            strokeWidth="1.05"
            fill="none"
            opacity={0.95 - index * 0.045}
          >
            {!reducedMotion && (
              <animate
                attributeName="d"
                dur={`${8 + index * 0.25}s`}
                repeatCount="indefinite"
                values={`M-80 ${420 + index * 10} C 120 ${560 - index * 4}, 330 ${280 + index * 6}, 560 ${355 + index * 2} C 770 ${425 - index * 2}, 980 ${560 - index * 5}, 1210 ${445 + index * 3} C 1310 ${392 + index * 2}, 1380 ${350 + index * 2}, 1540 ${425 + index * 4}; M-80 ${400 + index * 11} C 110 ${520 - index * 3}, 330 ${320 + index * 4}, 560 ${385 - index} C 780 ${455 - index * 3}, 990 ${515 - index * 4}, 1210 ${405 + index * 5} C 1325 ${365 + index * 3}, 1410 ${395 + index * 2}, 1540 ${410 + index * 5}; M-80 ${420 + index * 10} C 120 ${560 - index * 4}, 330 ${280 + index * 6}, 560 ${355 + index * 2} C 770 ${425 - index * 2}, 980 ${560 - index * 5}, 1210 ${445 + index * 3} C 1310 ${392 + index * 2}, 1380 ${350 + index * 2}, 1540 ${425 + index * 4}`}
              />
            )}
          </path>
        ))}
      </svg>

      <div
        className="absolute left-[18%] top-[22%] h-44 w-44 rounded-full bg-white blur-[120px]"
        style={reducedMotion ? { opacity: 0.08 } : { animation: 'athleteGlowPulse 8s ease-in-out infinite' }}
      />
      <div
        className="absolute right-[14%] bottom-[24%] h-56 w-56 rounded-full bg-white blur-[150px]"
        style={reducedMotion ? { opacity: 0.08 } : { animation: 'athleteGlowPulse 10s ease-in-out infinite' }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/55" />
    </div>
  )
}
