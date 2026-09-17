import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const products = [
  {
    id: 'recruiting',
    action: 'LAUNCH_RECRUITING',
    number: '01',
    eyebrow: 'Shared business clarity',
    title: 'CONSULTING DEMONSTRATION',
    description: 'Open the complete Darren and Jordan demonstration: authored BOS and Business Twin, one persistent MORE conversation, purpose-bound visual intelligence, and a mutual plan.',
    detail: 'HOME → YOU → YOUR BUSINESS → PLAN · Synthetic + read-only',
    tone: 'green',
  },
  {
    id: 'subscription-model-1',
    action: 'LAUNCH_SUBSCRIPTION_MODEL_1',
    number: '02',
    eyebrow: 'Living relationship',
    title: 'SUBSCRIPTION MODEL 1',
    description: 'Open MODEL 1 in its independently governed Jordan relationship, with its own conversation, Personal RSL, proposals, and publication history.',
    detail: 'Existing re-mid authority · Same-browser continuity · No billing',
    tone: 'violet',
  },
  {
    id: 'subscription-model-2',
    action: 'LAUNCH_SUBSCRIPTION_MODEL_2',
    number: '03',
    eyebrow: 'Living relationship',
    title: 'SUBSCRIPTION MODEL 2',
    description: 'Open MODEL 2 in its independently governed Jordan relationship, with its own conversation, Personal RSL, proposals, and publication history.',
    detail: 'Existing re-mid authority · Same-browser continuity · No billing',
    tone: 'violet',
  },
  {
    id: 'athlete-consulting-tool',
    action: 'LAUNCH_ATHLETE_CONSULTING_TOOL',
    number: '04',
    eyebrow: 'Shared athlete clarity',
    title: 'ATHLETE CONSULTING TOOL',
    description: 'Open the bounded Mika and Avery demonstration: one continuing Athlete relationship, shared current reality, source-bound coaching, mutual decisions, and visible learning over time.',
    detail: 'Ages 18–20 · Synthetic fixtures only · No customer access',
    tone: 'blue',
  },
  {
    id: 'presentations-athlete-reports',
    action: 'OPEN_DARREN_LIBRARY',
    number: '05',
    eyebrow: 'The story. The whole person.',
    title: 'PRESENTATIONS & ATHLETE REPORTS',
    description: 'Watch MORE ATHLETE — The Whole Story with Ava. View Lisa’s and Darren’s presentations, then explore the complete Youth BOS and APA reports, one athlete at a time.',
    detail: '1 film · 2 presentations · 5 BOS reports · 4 APA reports',
    tone: 'gold',
  },
]

const BASE_PRODUCT_IDS = ['recruiting', 'subscription-model-1', 'subscription-model-2']
const ATHLETE_PRODUCT_IDS = [...BASE_PRODUCT_IDS, 'athlete-consulting-tool']
const LIBRARY_PRODUCT_IDS = [...BASE_PRODUCT_IDS, 'presentations-athlete-reports']
const ATHLETE_LIBRARY_PRODUCT_IDS = [...ATHLETE_PRODUCT_IDS, 'presentations-athlete-reports']

export default function LeadershipDemo() {
  const [status, setStatus] = useState('loading')
  const [csrfToken, setCsrfToken] = useState('')
  const [busyProduct, setBusyProduct] = useState('')
  const [error, setError] = useState('')
  const [availableProductIds, setAvailableProductIds] = useState(BASE_PRODUCT_IDS)
  const [athleteVersion, setAthleteVersion] = useState(1)

  const hydrateLauncher = useCallback(async () => {
    setStatus('loading')
    setCsrfToken('')
    try {
      const response = await fetch('/api/internal/leadership-demo-entry?view=launcher', { credentials: 'same-origin', cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      const receivedIds = Array.isArray(payload?.choices) ? payload.choices.map((choice) => choice?.id) : []
      const exactBase = JSON.stringify(receivedIds) === JSON.stringify(BASE_PRODUCT_IDS)
      const exactAthlete = JSON.stringify(receivedIds) === JSON.stringify(ATHLETE_PRODUCT_IDS)
      const exactLibrary = JSON.stringify(receivedIds) === JSON.stringify(LIBRARY_PRODUCT_IDS)
      const exactAthleteLibrary = JSON.stringify(receivedIds) === JSON.stringify(ATHLETE_LIBRARY_PRODUCT_IDS)
      if (!response.ok || payload?.ok !== true || !payload.csrf_token || (!exactBase && !exactAthlete && !exactLibrary && !exactAthleteLibrary)) {
        setStatus('locked')
        return
      }
      setAvailableProductIds(receivedIds)
      setAthleteVersion(payload.choices.find(choice => choice.id === 'athlete-consulting-tool')?.version === 2 ? 2 : 1)
      setCsrfToken(payload.csrf_token)
      setStatus('ready')
    } catch {
      setStatus('locked')
    }
  }, [])

  useEffect(() => {
    hydrateLauncher()
    const restoreAfterProduct = (event) => {
      if (event.persisted) hydrateLauncher()
    }
    window.addEventListener('pageshow', restoreAfterProduct)
    return () => window.removeEventListener('pageshow', restoreAfterProduct)
  }, [hydrateLauncher])

  async function launch(product) {
    if (!csrfToken || busyProduct) return
    const launchToken = csrfToken
    setBusyProduct(product.id)
    setCsrfToken('')
    setError('')
    try {
      const response = await fetch('/api/internal/leadership-demo-entry', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'content-type': 'application/json',
          'x-leadership-demo-launch-csrf': launchToken,
        },
        body: JSON.stringify({ action: product.action }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || payload?.ok !== true || !['/recruiting-gu-v1/demo', '/subscription', '/athlete-consulting-tool/demo', '/darren-library/library'].includes(payload.redirect_to)) {
        throw new Error(payload?.code || 'LEADERSHIP_DEMO_LAUNCH_FAILED')
      }
      window.location.assign(payload.redirect_to)
    } catch {
      setError('That demo could not be opened. Please try again.')
      await hydrateLauncher()
    } finally {
      setBusyProduct('')
    }
  }

  if (status === 'loading') return <LeadershipDemoStatus title="Opening Darren’s demo area…" />
  if (status === 'locked') return <LockedLeadershipDemo />

  const availableProducts = products.filter((product) => availableProductIds.includes(product.id))

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030605] text-white">
      <DemoBackground />
      <header className="relative z-10 border-b border-white/10 bg-black/35 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/" className="text-lg font-semibold tracking-wide md:text-xl">MoreMindMap</Link>
          <Link to="/leadership" className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white">Leadership Portal</Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 py-16 md:py-24">
        <section className="max-w-4xl">
          <div className="inline-flex rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-xs uppercase tracking-[0.28em] text-emerald-100">Darren’s demo area</div>
          <h1 className="mt-7 text-5xl font-semibold tracking-tight md:text-7xl">{availableProducts.length === 5 ? 'Four product demos. Film, presentations and athlete reports.' : `${availableProducts.length} products. One bounded demo area.`}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/66 md:text-xl">Choose what you’d like to explore. Each experience stays inside the protected DarrenDemo boundary.</p>
        </section>

        {error && <div className="mt-8 rounded-2xl border border-red-400/25 bg-red-500/10 px-5 py-4 text-sm text-red-100" role="alert">{error}</div>}

        <section className={`mt-12 grid gap-6 ${availableProducts.length >= 4 ? 'lg:grid-cols-2 xl:grid-cols-3' : 'lg:grid-cols-3'}`} aria-label="Product demos">
          {availableProducts.map((original) => {
            const product = original.id === 'athlete-consulting-tool' && athleteVersion === 2
              ? { ...original, title: 'ATHLETE CONSULTING TOOL V2', description: original.description.replace('Mika and Avery', 'Nia and Sofia'), detail: 'Ages 15 and 19 · Synthetic fixtures only · No customer access' }
              : original
            return (
            <button
              key={product.id}
              type="button"
              onClick={() => launch(product)}
              disabled={Boolean(busyProduct) || !csrfToken}
              className={`group min-h-[360px] rounded-[2rem] border p-8 text-left shadow-[0_24px_90px_rgba(0,0,0,0.42)] backdrop-blur-md transition hover:-translate-y-1 focus:outline-none focus:ring-4 disabled:cursor-wait disabled:opacity-55 ${product.tone === 'green' ? 'border-emerald-300/24 bg-[linear-gradient(145deg,rgba(13,62,40,.58),rgba(4,17,15,.92))] focus:ring-emerald-300/15' : product.tone === 'blue' ? 'border-sky-300/24 bg-[linear-gradient(145deg,rgba(18,68,92,.62),rgba(6,16,28,.94))] focus:ring-sky-300/15' : product.tone === 'gold' ? 'border-amber-300/30 bg-[linear-gradient(145deg,rgba(87,65,20,.7),rgba(18,16,9,.96))] focus:ring-amber-300/20' : 'border-violet-300/24 bg-[linear-gradient(145deg,rgba(53,35,88,.62),rgba(10,12,24,.94))] focus:ring-violet-300/15'}`}
            >
              <div className="flex items-start justify-between gap-6">
                <span className={`text-sm font-semibold tracking-[0.2em] ${product.tone === 'green' ? 'text-emerald-300' : product.tone === 'blue' ? 'text-sky-300' : product.tone === 'gold' ? 'text-amber-200' : 'text-violet-300'}`}>{product.number}</span>
                <span className="rounded-full border border-white/12 bg-black/25 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/54">{product.tone === 'gold' ? 'Protected library' : 'Synthetic demo'}</span>
              </div>
              <div className="mt-16 text-xs uppercase tracking-[0.24em] text-white/42">{product.eyebrow}</div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">{product.title}</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/62">{product.description}</p>
              <div className="mt-8 border-t border-white/10 pt-6">
                <small className="block text-xs leading-5 text-white/42">{product.detail}</small>
                <strong className={`mt-5 flex items-center justify-between text-sm ${product.tone === 'green' ? 'text-emerald-200' : product.tone === 'blue' ? 'text-sky-200' : product.tone === 'gold' ? 'text-amber-100' : 'text-violet-200'}`}>
                  {busyProduct === product.id ? 'Opening experience…' : `Open ${product.title}`}
                  <span aria-hidden="true">→</span>
                </strong>
              </div>
            </button>
            )
          })}
        </section>

        <footer className="mt-10 flex items-center gap-3 text-sm text-white/38"><span aria-hidden="true">◇</span> Access is bounded, browser-bound, and expires automatically. The library labels its private reading separately from fictional athletes.</footer>
      </main>
    </div>
  )
}

function LeadershipDemoStatus({ title }) {
  return <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 text-white"><DemoBackground /><div className="relative z-10 text-center"><div className="mx-auto h-12 w-12 animate-pulse rounded-full border border-emerald-300/30 bg-emerald-400/10" /><h1 className="mt-6 text-2xl font-semibold">{title}</h1></div></div>
}

function LockedLeadershipDemo() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 text-white">
      <DemoBackground />
      <div className="relative z-10 max-w-xl rounded-[2rem] border border-white/12 bg-white/[0.055] p-8 text-center shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-orange-300/30 bg-orange-400/10 text-orange-100">L</div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Leadership Demo Locked</h1>
        <p className="mt-4 text-white/62">Enter the demo access code in the Leadership Portal to create a fresh, bounded demo session.</p>
        <Link to="/leadership" className="mt-7 inline-flex rounded-2xl bg-white px-6 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-black transition hover:bg-orange-100">Go to Access Screen</Link>
      </div>
    </div>
  )
}

function DemoBackground() {
  return <div className="pointer-events-none absolute inset-0"><div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(34,197,94,0.17),transparent_30%),radial-gradient(circle_at_84%_24%,rgba(139,92,246,0.16),transparent_30%),radial-gradient(circle_at_58%_78%,rgba(14,165,233,0.1),transparent_34%)]" /><div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] opacity-35" /></div>
}
