import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const DEMO_CODE = 'darrendemo'

export default function LeadershipPortal() {
  const navigate = useNavigate()
  const [accessCode, setAccessCode] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()

    if (accessCode.trim().toLowerCase() !== DEMO_CODE) {
      setError('That access code is not recognized.')
      return
    }

    sessionStorage.setItem('leadershipDemoAccess', 'true')
    navigate('/leadership-demo')
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <PortalBackground />

      <header className="relative z-10 border-b border-white/10 bg-black/30 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/" className="text-lg font-semibold tracking-wide md:text-xl">
            MoreMindMap
          </Link>
          <Link
            to="/"
            className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Back to Home
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-82px)] max-w-7xl items-center px-6 py-16">
        <section className="grid w-full gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <div className="inline-flex rounded-full border border-orange-300/25 bg-orange-400/10 px-4 py-2 text-xs uppercase tracking-[0.28em] text-orange-100">
              Executive Demo Access
            </div>
            <h1 className="mt-7 text-5xl font-semibold tracking-tight md:text-7xl">
              Leadership Portal
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/68 md:text-xl">
              Enter your access code.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/12 bg-white/[0.055] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-md md:p-8">
            <div className="rounded-[1.5rem] border border-orange-300/20 bg-black/45 p-6 md:p-8">
              <div className="text-xs uppercase tracking-[0.24em] text-white/42">
                Demo Gate
              </div>
              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <label className="block">
                  <span className="text-sm font-medium text-white/72">Access code</span>
                  <input
                    value={accessCode}
                    onChange={(event) => {
                      setAccessCode(event.target.value)
                      if (error) setError('')
                    }}
                    autoComplete="off"
                    className="mt-3 w-full rounded-2xl border border-white/12 bg-black/50 px-5 py-4 text-base text-white outline-none transition placeholder:text-white/28 focus:border-orange-300/60 focus:ring-4 focus:ring-orange-300/10"
                    placeholder="Enter code"
                  />
                </label>

                {error && (
                  <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-white px-6 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-black transition hover:bg-orange-100"
                >
                  Enter Portal
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function PortalBackground() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(168,85,247,0.18),transparent_30%),radial-gradient(circle_at_82%_35%,rgba(249,115,22,0.16),transparent_28%),radial-gradient(circle_at_56%_80%,rgba(14,165,233,0.12),transparent_30%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:72px_72px] opacity-35" />
      <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-orange-300/30 to-transparent" />
    </div>
  )
}
