import { Link } from 'react-router-dom'

export default function App() {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      <AnimatedWaveBackground />

      <header className="relative z-10 border-b border-white/10 bg-black/30 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
          <div className="text-lg md:text-xl font-semibold tracking-wide">MoreMindMap</div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-white/70">
            <a href="#paths" className="hover:text-white transition">Start Here</a>
            <a href="#about" className="hover:text-white transition">About</a>
            <a href="#ecosystem" className="hover:text-white transition">Connected Systems</a>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-7xl px-6 pt-24 pb-20 md:pt-32 md:pb-28">
          <div className="max-w-4xl">
            <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/60 backdrop-blur">
              Strategic Front Door
            </div>
            <h1 className="mt-8 text-5xl md:text-7xl leading-[0.95] font-semibold tracking-tight max-w-5xl">
              Start with the map.
            </h1>
            <p className="mt-6 max-w-3xl text-lg md:text-2xl text-white/72 leading-relaxed">
              Understand how you think, how your business is built, and where your hidden revenue lives.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <a
                href="#paths"
                className="inline-flex items-center justify-center rounded-2xl bg-white text-black px-6 py-4 text-base font-medium hover:bg-white/90 transition shadow-[0_0_40px_rgba(255,255,255,0.1)]"
              >
                Explore Your Starting Point
              </a>
              <a
                href="#about"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-base font-medium text-white hover:bg-white/10 transition backdrop-blur"
              >
                Learn How It Works
              </a>
            </div>
          </div>
        </section>

        <section id="paths" className="mx-auto max-w-7xl px-6 pb-24 md:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <PathCard
              eyebrow="Path 1"
              title="Build Your MORE MindMap Profile"
              description="Understand how you think, communicate, decide, and operate. Get a sharper picture of your strengths, blind spots, and working style."
              button="Start Here"
              to="/profile"
            />
            <PathCard
              eyebrow="Path 2"
              title="Assess Your Real Estate Business"
              description="Get a direct diagnosis of your business, your database, and your next stage of growth using a strategic relationship-first assessment."
              button="Start Here"
              to="/real-estate"
              featured
            />
            <PathCard
              eyebrow="Path 3"
              title="Recover or Reactivate Your Dead Leads"
              description="You may not need more leads first. You may need to recover the revenue sitting in the leads you already paid for."
              button="Start Here"
              to="/recovery"
            />
          </div>
        </section>

        <section id="about" className="mx-auto max-w-7xl px-6 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-8 items-start">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md p-8 md:p-10 shadow-2xl shadow-black/30">
              <div className="text-xs uppercase tracking-[0.22em] text-white/45">What this is</div>
              <h2 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight">
                MoreMindMap is your strategic starting point.
              </h2>
              <p className="mt-5 text-white/72 text-base md:text-lg leading-8">
                Most people try to fix their business before they understand it. MoreMindMap helps you start in the right place by giving you clarity on how you think, how your business is structured, and where your opportunities actually are.
              </p>
              <p className="mt-5 text-white/60 text-base md:text-lg leading-8">
                This is not fluff, and it is not a generic quiz funnel. It is a diagnostic front door designed to route people toward the right next move with more precision.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-md p-8 md:p-10">
              <div className="text-xs uppercase tracking-[0.22em] text-white/45">Core idea</div>
              <div className="mt-5 space-y-5 text-white/78 leading-7">
                <p>Understand yourself.</p>
                <p>Understand your business.</p>
                <p>Understand the revenue you are missing.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="ecosystem" className="mx-auto max-w-7xl px-6 pb-28">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 md:p-10 backdrop-blur-md">
            <div className="text-xs uppercase tracking-[0.22em] text-white/45">Connected Systems</div>
            <h3 className="mt-4 text-2xl md:text-3xl font-semibold tracking-tight">
              Connected to real operating systems.
            </h3>
            <p className="mt-5 max-w-4xl text-white/68 text-base md:text-lg leading-8">
              MoreMindMap connects into The MORE Companies and Revenue Recovery Group. It is designed to function as a front-door diagnostic layer that helps people start in the right place, then move into the right conversation, system, or solution.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

function PathCard({ eyebrow, title, description, button, to, featured = false }) {
  return (
    <div
      className={[
        "group rounded-[2rem] border p-7 md:p-8 backdrop-blur-md transition duration-300 min-h-[320px] flex flex-col justify-between",
        featured
          ? "border-white/20 bg-white/[0.08] shadow-[0_20px_60px_rgba(255,255,255,0.07)]"
          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]",
      ].join(" ")}
    >
      <div>
        <div className="text-xs uppercase tracking-[0.22em] text-white/42">{eyebrow}</div>
        <h3 className="mt-5 text-2xl md:text-[1.85rem] leading-tight font-semibold tracking-tight max-w-sm">
          {title}
        </h3>
        <p className="mt-5 text-white/66 text-base leading-7">{description}</p>
      </div>
      <div className="pt-8">
        <Link
          to={to}
          className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/8 px-5 py-3.5 text-sm font-medium text-white transition group-hover:bg-white group-hover:text-black"
        >
          {button}
        </Link>
      </div>
    </div>
  )
}

function AnimatedWaveBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes driftSlow {
          0% { transform: translate3d(-2%, 0, 0) scaleX(1.02); }
          50% { transform: translate3d(2%, 1%, 0) scaleX(0.99); }
          100% { transform: translate3d(-2%, 0, 0) scaleX(1.02); }
        }

        @keyframes driftFast {
          0% { transform: translate3d(2%, 0, 0) scaleX(1); }
          50% { transform: translate3d(-2%, -1%, 0) scaleX(1.015); }
          100% { transform: translate3d(2%, 0, 0) scaleX(1); }
        }

        @keyframes glowPulse {
          0% { opacity: 0.08; }
          50% { opacity: 0.18; }
          100% { opacity: 0.08; }
        }
      `}</style>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.08),transparent_26%),radial-gradient(circle_at_78%_72%,rgba(255,255,255,0.06),transparent_28%)]" />

      <svg
        viewBox="0 0 1440 820"
        className="absolute inset-x-[-6%] top-[10%] w-[112%] h-[42%] opacity-45"
        preserveAspectRatio="none"
        style={{ animation: 'driftSlow 18s ease-in-out infinite' }}
      >
        <defs>
          <linearGradient id="softWave" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="30%" stopColor="rgba(255,255,255,0.28)" />
            <stop offset="52%" stopColor="rgba(255,255,255,0.85)" />
            <stop offset="74%" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        <path
          d="M-40 290 C 120 245, 250 335, 420 292 C 610 245, 735 180, 905 228 C 1085 278, 1220 355, 1480 300"
          stroke="url(#softWave)"
          strokeWidth="1.2"
          fill="none"
        >
          <animate
            attributeName="d"
            dur="9s"
            repeatCount="indefinite"
            values="
              M-40 290 C 120 245, 250 335, 420 292 C 610 245, 735 180, 905 228 C 1085 278, 1220 355, 1480 300;
              M-40 305 C 135 220, 260 300, 430 320 C 610 342, 760 170, 930 220 C 1110 272, 1245 338, 1480 286;
              M-40 290 C 120 245, 250 335, 420 292 C 610 245, 735 180, 905 228 C 1085 278, 1220 355, 1480 300
            "
          />
        </path>

        <path
          d="M-40 322 C 130 280, 270 372, 448 330 C 635 286, 760 218, 930 258 C 1110 300, 1240 380, 1480 330"
          stroke="url(#softWave)"
          strokeWidth="1"
          fill="none"
          opacity="0.7"
        >
          <animate
            attributeName="d"
            dur="10.5s"
            repeatCount="indefinite"
            values="
              M-40 322 C 130 280, 270 372, 448 330 C 635 286, 760 218, 930 258 C 1110 300, 1240 380, 1480 330;
              M-40 345 C 150 250, 290 345, 460 356 C 648 368, 760 230, 935 252 C 1124 278, 1260 350, 1480 322;
              M-40 322 C 130 280, 270 372, 448 330 C 635 286, 760 218, 930 258 C 1110 300, 1240 380, 1480 330
            "
          />
        </path>
      </svg>

      <svg
        viewBox="0 0 1440 900"
        className="absolute inset-x-[-10%] bottom-[-2%] w-[120%] h-[48%] opacity-70"
        preserveAspectRatio="none"
        style={{ animation: 'driftFast 24s ease-in-out infinite' }}
      >
        <defs>
          <linearGradient id="brightWave" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="18%" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="48%" stopColor="rgba(255,255,255,0.95)" />
            <stop offset="74%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        {Array.from({ length: 16 }).map((_, i) => (
          <path
            key={i}
            d={`M-80 ${420 + i * 10} C 120 ${560 - i * 4}, 330 ${280 + i * 6}, 560 ${355 + i * 2} C 770 ${425 - i * 2}, 980 ${560 - i * 5}, 1210 ${445 + i * 3} C 1310 ${392 + i * 2}, 1380 ${350 + i * 2}, 1540 ${425 + i * 4}`}
            stroke="url(#brightWave)"
            strokeWidth="1.05"
            fill="none"
            opacity={0.95 - i * 0.045}
          >
            <animate
              attributeName="d"
              dur={`${8 + i * 0.25}s`}
              repeatCount="indefinite"
              values={`
                M-80 ${420 + i * 10} C 120 ${560 - i * 4}, 330 ${280 + i * 6}, 560 ${355 + i * 2} C 770 ${425 - i * 2}, 980 ${560 - i * 5}, 1210 ${445 + i * 3} C 1310 ${392 + i * 2}, 1380 ${350 + i * 2}, 1540 ${425 + i * 4};
                M-80 ${400 + i * 11} C 110 ${520 - i * 3}, 330 ${320 + i * 4}, 560 ${385 - i * 1} C 780 ${455 - i * 3}, 990 ${515 - i * 4}, 1210 ${405 + i * 5} C 1325 ${365 + i * 3}, 1410 ${395 + i * 2}, 1540 ${410 + i * 5};
                M-80 ${420 + i * 10} C 120 ${560 - i * 4}, 330 ${280 + i * 6}, 560 ${355 + i * 2} C 770 ${425 - i * 2}, 980 ${560 - i * 5}, 1210 ${445 + i * 3} C 1310 ${392 + i * 2}, 1380 ${350 + i * 2}, 1540 ${425 + i * 4}
              `}
            />
          </path>
        ))}
      </svg>

      <div
        className="absolute left-[18%] top-[22%] h-44 w-44 rounded-full bg-white blur-[120px]"
        style={{ animation: 'glowPulse 8s ease-in-out infinite' }}
      />
      <div
        className="absolute right-[14%] bottom-[24%] h-56 w-56 rounded-full bg-white blur-[150px]"
        style={{ animation: 'glowPulse 10s ease-in-out infinite' }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/55" />
    </div>
  )
}
