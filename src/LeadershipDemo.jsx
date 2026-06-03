import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { craigFoxSlides, executiveBoardSlides } from './lib/leadershipDemoSlides'

export default function LeadershipDemo() {
  const [hasAccess, setHasAccess] = useState(false)
  const [selectedSlide, setSelectedSlide] = useState(null)

  useEffect(() => {
    setHasAccess(sessionStorage.getItem('leadershipDemoAccess') === 'true')
  }, [])

  useEffect(() => {
    if (!selectedSlide) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedSlide(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedSlide])

  if (!hasAccess) {
    return <LockedLeadershipDemo />
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <DemoBackground />

      <header className="relative z-10 border-b border-white/10 bg-black/35 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/" className="text-lg font-semibold tracking-wide md:text-xl">
            MoreMindMap
          </Link>
          <Link
            to="/leadership"
            className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Leadership Portal
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <section className="max-w-4xl">
          <div className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-xs uppercase tracking-[0.28em] text-cyan-100">
            Demo Experience
          </div>
          <h1 className="mt-7 text-4xl font-semibold tracking-tight md:text-6xl">
            Leadership Intelligence Demo
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/66">
            Two demonstration decks for leadership conversations. Click any slide to open a fullscreen preview.
          </p>
        </section>

        <DemoSection
          eyebrow="Demo A"
          title="Craig Fox Recruiting Intelligence Demo"
          description="Six slide slots for recruiting intelligence, agent attraction, conversion friction, and field-leadership leverage."
          slides={craigFoxSlides}
          onOpen={setSelectedSlide}
        />

        <DemoSection
          eyebrow="Demo B"
          title="Executive / Board Intelligence Demo"
          description="Four slide slots for board-level constraints, leadership risk, operating leverage, and action briefing."
          slides={executiveBoardSlides}
          onOpen={setSelectedSlide}
        />
      </main>

      {selectedSlide && (
        <SlideLightbox slide={selectedSlide} onClose={() => setSelectedSlide(null)} />
      )}
    </div>
  )
}

function LockedLeadershipDemo() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 text-white">
      <DemoBackground />
      <div className="relative z-10 max-w-xl rounded-[2rem] border border-white/12 bg-white/[0.055] p-8 text-center shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-orange-300/30 bg-orange-400/10 text-orange-100">
          L
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          Leadership Demo Locked
        </h1>
        <p className="mt-4 text-white/62">
          Enter the demo access code to open the Leadership Intelligence experience.
        </p>
        <Link
          to="/leadership"
          className="mt-7 inline-flex rounded-2xl bg-white px-6 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-black transition hover:bg-orange-100"
        >
          Go to Access Screen
        </Link>
      </div>
    </div>
  )
}

function DemoSection({ eyebrow, title, description, slides, onOpen }) {
  return (
    <section className="mt-16">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-white/42">{eyebrow}</div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-4xl">
            {title}
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-white/55 md:text-right">
          {description}
        </p>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {slides.map((slide, index) => (
          <SlideCard
            key={slide.image}
            slide={slide}
            number={index + 1}
            onOpen={() => onOpen({ ...slide, number: index + 1 })}
          />
        ))}
      </div>
    </section>
  )
}

function SlideCard({ slide, number, onOpen }) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] text-left shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:-translate-y-1 hover:border-orange-300/35 hover:bg-white/[0.07]"
    >
      <div className="relative aspect-[16/10] border-b border-white/10 bg-black/45">
        {!imageFailed && (
          <img
            src={slide.image}
            alt={slide.title}
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        )}
        {imageFailed && <SlidePlaceholder slide={slide} number={number} />}
        <div className="absolute left-4 top-4 rounded-full border border-white/12 bg-black/60 px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/70 backdrop-blur">
          Slide {String(number).padStart(2, '0')}
        </div>
      </div>
      <div className="p-5">
        <div className="text-xs uppercase tracking-[0.22em] text-orange-200/70">
          {slide.type}
        </div>
        <h3 className="mt-3 text-xl font-semibold tracking-tight text-white">
          {slide.title}
        </h3>
        <p className="mt-3 text-sm leading-6 text-white/58">{slide.subtitle}</p>
        <div className="mt-5 text-xs uppercase tracking-[0.18em] text-cyan-100/70">
          Click to open fullscreen
        </div>
      </div>
    </button>
  )
}

function SlidePlaceholder({ slide, number }) {
  return (
    <div className="flex h-full flex-col justify-between bg-[radial-gradient(circle_at_25%_20%,rgba(168,85,247,0.22),transparent_34%),radial-gradient(circle_at_78%_70%,rgba(249,115,22,0.2),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6">
      <div className="flex justify-end">
        <div className="h-12 w-12 rounded-full border border-cyan-300/30 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.16)]" />
      </div>
      <div>
        <div className="text-xs uppercase tracking-[0.24em] text-white/45">
          Placeholder Asset
        </div>
        <div className="mt-2 text-2xl font-semibold text-white">
          {String(number).padStart(2, '0')}
        </div>
        <div className="mt-4 h-px w-full bg-gradient-to-r from-orange-300/45 via-cyan-300/35 to-transparent" />
        <div className="mt-4 text-sm font-medium text-white/80">{slide.title}</div>
      </div>
    </div>
  )
}

function SlideLightbox({ slide, onClose }) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/88 p-4 backdrop-blur-xl md:p-8"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative max-h-full w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/14 bg-[#050505] shadow-[0_30px_120px_rgba(0,0,0,0.8)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full border border-white/15 bg-black/70 px-4 py-2 text-sm text-white/72 backdrop-blur transition hover:bg-white hover:text-black"
        >
          Close
        </button>

        <div className="aspect-[16/9] bg-black">
          {!imageFailed && (
            <img
              src={slide.image}
              alt={slide.title}
              className="h-full w-full object-contain"
              onError={() => setImageFailed(true)}
            />
          )}
          {imageFailed && <SlidePlaceholder slide={slide} number={slide.number || 1} />}
        </div>

        <div className="border-t border-white/10 p-5 md:p-6">
          <div className="text-xs uppercase tracking-[0.22em] text-orange-200/70">
            {slide.type}
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            {slide.title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/58">{slide.subtitle}</p>
        </div>
      </div>
    </div>
  )
}

function DemoBackground() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(168,85,247,0.16),transparent_30%),radial-gradient(circle_at_84%_24%,rgba(249,115,22,0.15),transparent_30%),radial-gradient(circle_at_58%_78%,rgba(14,165,233,0.12),transparent_34%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] opacity-35" />
    </div>
  )
}
