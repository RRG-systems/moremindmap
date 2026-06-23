import { useEffect, useMemo, useState } from 'react'

function display(value) {
  if (value === null || value === undefined || value === '') return 'Unavailable'
  return String(value)
}

function formatListKey(value) {
  return display(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function sectionStatus(status) {
  if (!status) return 'Scaffold'
  return display(status).replace(/_/g, ' ')
}

export default function DarrenLeadershipIntelligencePanel({ adminCode }) {
  const [snapshotState, setSnapshotState] = useState({
    status: 'loading',
    data: null,
    error: ''
  })
  const [generationState, setGenerationState] = useState({
    status: 'idle',
    data: null,
    error: ''
  })

  useEffect(() => {
    if (!adminCode) {
      setSnapshotState({
        status: 'locked',
        data: null,
        error: 'Darren Intelligence Snapshot access was not found for this session.'
      })
      return undefined
    }

    const controller = new AbortController()

    async function loadSnapshot() {
      setSnapshotState({ status: 'loading', data: null, error: '' })

      try {
        const response = await fetch('/api/admin/darren-intelligence-snapshot', {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-Admin-Code': adminCode
          },
          signal: controller.signal
        })
        const payload = await response.json().catch(() => null)

        if (response.status === 403) {
          setSnapshotState({
            status: 'denied',
            data: null,
            error: 'Darren Intelligence Snapshot access was not recognized.'
          })
          return
        }

        if (!response.ok || !payload?.ok) {
          setSnapshotState({
            status: 'error',
            data: null,
            error: 'Darren Intelligence Snapshot unavailable.'
          })
          return
        }

        setSnapshotState({ status: 'ready', data: payload, error: '' })
      } catch (error) {
        if (error.name === 'AbortError') return
        setSnapshotState({
          status: 'error',
          data: null,
          error: 'Darren Intelligence Snapshot unavailable.'
        })
      }
    }

    loadSnapshot()

    return () => controller.abort()
  }, [adminCode])

  return (
    <section className="rounded-2xl border border-violet-300/18 bg-violet-400/[0.075] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-violet-100/62">Darren Leadership Intelligence</div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Your Momentum Machine operating view
          </h2>
          <p className="mt-3 max-w-5xl text-sm leading-6 text-violet-50/74">
            Your cockpit for turning MORE MindMap + RRG into purposeful scale through your momentum, your strategy, your opportunity map, your sales story, and your next proof target.
          </p>
        </div>
        <div className="rounded-xl border border-violet-200/20 bg-black/24 px-4 py-3 text-xs leading-5 text-violet-50/68 md:max-w-xs">
          Snapshot-first. No chat, no model generation, and no final Five Futures or One Move yet.
        </div>
      </div>

      {snapshotState.status === 'loading' && (
        <SnapshotState title="Loading Darren Intelligence" body="Retrieving the source-labeled snapshot." />
      )}
      {(snapshotState.status === 'locked' || snapshotState.status === 'denied' || snapshotState.status === 'error') && (
        <SnapshotState title="Darren Intelligence Snapshot unavailable" body={snapshotState.error} tone="error" />
      )}
      {snapshotState.status === 'ready' && (
        <DarrenSnapshotContent
          snapshot={snapshotState.data}
          adminCode={adminCode}
          generationState={generationState}
          setGenerationState={setGenerationState}
        />
      )}
    </section>
  )
}

function DarrenSnapshotContent({ snapshot, adminCode, generationState, setGenerationState }) {
  const darren = snapshot?.darren || {}
  const strategicGoal = snapshot?.strategic_goal || {}
  const eToP = snapshot?.e_to_p_lens || {}
  const pathComparison = snapshot?.path_comparison || {}
  const paths = asArray(pathComparison.paths)
  const futures = asArray(snapshot?.five_futures_scaffold)
  const oneMove = snapshot?.one_move_scaffold || {}
  const proofTargets = asArray(snapshot?.next_proof_targets)
  const overclaimBoundaries = asArray(snapshot?.what_not_to_overclaim)
  const unavailableFields = asArray(snapshot?.unavailable_fields)
  const evidenceGaps = asArray(snapshot?.evidence_gaps)
  const dashboardContext = snapshot?.current_dashboard_context || {}

  const contextCards = useMemo(() => [
    {
      label: 'Your strongest live signal',
      value: `${display(darren.behavioral_identity)} / ${display(darren.operating_mode)}`
    },
    {
      label: 'Profile source',
      value: display(darren.profile_id)
    },
    {
      label: 'Dashboard profiles',
      value: display(dashboardContext.total_profiles)
    },
    {
      label: 'Business assessments',
      value: display(dashboardContext.total_business_assessments)
    }
  ], [darren.behavioral_identity, darren.operating_mode, darren.profile_id, dashboardContext.total_profiles, dashboardContext.total_business_assessments])

  return (
    <div className="mt-7 space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {contextCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-white/10 bg-black/24 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/38">{card.label}</div>
            <div className="mt-3 text-lg font-semibold leading-7 text-white">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <PanelBlock eyebrow="Darren Operating Style" title="Momentum into Purposeful Scale">
          <FieldLabel label="Operating mode" value={darren.operating_mode} />
          <FieldLabel label="Operating advantage" value={darren.operating_advantage} />
          <FieldLabel label="Operating risk" value={darren.operating_risk} />
          <FieldLabel label="Purposeful scale recommendation" value={darren.purposeful_scale_recommendation} />
        </PanelBlock>

        <PanelBlock eyebrow="Strategic Goal" title="Scenario Lens, Not Guaranteed Valuation">
          <FieldLabel label="Target company valuation" value={strategicGoal.target_company_valuation} />
          <FieldLabel label="Gross revenue lens" value={strategicGoal.gross_revenue_lens} />
          <ListItems items={asArray(strategicGoal.valuation_multiple_notes)} />
          <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-50/78">
            {display(strategicGoal.truth_boundary || 'This is a scenario lens, not a guaranteed valuation rule.')}
          </div>
        </PanelBlock>
      </div>

      <PanelBlock eyebrow="E->P Lens" title="Entrepreneurial Energy Into Purposeful Execution">
        <div className="grid gap-4 lg:grid-cols-2">
          <FieldLabel label="Entrepreneurial" value="Momentum, instinct, speed, vision, energy, sales pressure, and partner activation." />
          <FieldLabel label="Purposeful" value="Models, systems, tools, accountability, coaching, ongoing education, and no hubris." />
          <FieldLabel label="Model needed" value={eToP.model_needed} />
          <FieldLabel label="Proof needed" value={eToP.proof_needed} />
        </div>
        <p className="mt-4 rounded-xl border border-emerald-300/18 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-50/78">
          The goal is not to slow your momentum. The goal is to make it repeatable.
        </p>
      </PanelBlock>

      <PanelBlock eyebrow="Opportunity Path Comparison" title="Your Strategic Options">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {paths.map((path) => (
            <div key={path} className="rounded-xl border border-white/10 bg-black/24 p-4">
              <div className="text-sm font-semibold leading-6 text-white">{display(path)}</div>
              <div className="mt-3 text-xs uppercase tracking-[0.16em] text-violet-100/46">Evidence state</div>
              <p className="mt-2 text-sm leading-6 text-white/56">
                Compare against dashboard metrics, revenue evidence, partner proof, channel proof, and product truth before treating this as your strongest path.
              </p>
            </div>
          ))}
        </div>
        <ListWithTitle title="Truth boundaries" items={asArray(pathComparison.truth_boundaries)} />
      </PanelBlock>

      <PanelBlock eyebrow="Five Futures Scaffold" title="Scaffolded Futures, Not Final Generated Strategy">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {futures.map((future) => (
            <div key={future.key} className="rounded-xl border border-white/10 bg-black/24 p-4">
              <div className="text-sm font-semibold leading-6 text-white">{formatListKey(future.key)}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.16em] text-white/38">{sectionStatus(future.status)}</div>
              <ListWithTitle title="Required for final generation" items={asArray(future.required_fields_for_generation).slice(0, 5)} compact />
            </div>
          ))}
        </div>
      </PanelBlock>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <PanelBlock eyebrow="One Move Scaffold" title="Your Next Focus Will Stay Concrete">
          <FieldLabel label="Status" value={sectionStatus(oneMove.status)} />
          <FieldLabel label="Cadence" value={oneMove.cadence} />
          <ListWithTitle title="Requirements" items={asArray(oneMove.requirements)} />
          <p className="mt-4 text-sm leading-6 text-white/54">
            Final generated One Move comes later. This scaffold keeps it weekly, sales-useful, and tied to evidence.
          </p>
        </PanelBlock>

        <PanelBlock eyebrow="Your Next Proof Targets" title="Make The Strongest Path More Evident">
          <ListItems items={proofTargets} />
        </PanelBlock>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PanelBlock eyebrow="What Not To Overclaim" title="Sales Story Guardrails">
          <ListItems items={overclaimBoundaries} />
        </PanelBlock>
        <PanelBlock eyebrow="Unavailable / Not Yet Live" title="Honest Missing Intelligence">
          <ListItems items={unavailableFields} />
          <ListWithTitle title="Evidence gaps" items={evidenceGaps} />
        </PanelBlock>
      </div>

      <GenerationControl
        adminCode={adminCode}
        generationState={generationState}
        setGenerationState={setGenerationState}
      />
    </div>
  )
}

function GenerationControl({ adminCode, generationState, setGenerationState }) {
  async function generateIntelligence() {
    if (!adminCode || generationState.status === 'loading') return

    setGenerationState({ status: 'loading', data: null, error: '' })

    try {
      const response = await fetch('/api/admin/darren-intelligence-generate', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'X-Admin-Code': adminCode
        }
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.ok) {
        setGenerationState({
          status: 'error',
          data: null,
          error: generationErrorMessage(payload?.error)
        })
        return
      }

      setGenerationState({ status: 'ready', data: payload, error: '' })
    } catch {
      setGenerationState({
        status: 'error',
        data: null,
        error: 'Darren Five Futures + One Move generation is unavailable right now.'
      })
    }
  }

  return (
    <section className="rounded-2xl border border-emerald-300/18 bg-emerald-400/[0.08] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-emerald-100/58">Generated Strategy</div>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">
            Generate Darren Five Futures + One Move
          </h3>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-emerald-50/72">
            Generate the actual MMM + RRG Five Futures and this week&apos;s One Move from the current source-labeled snapshot. This is not chat and does not save a persistent artifact yet.
          </p>
        </div>
        <button
          type="button"
          onClick={generateIntelligence}
          disabled={generationState.status === 'loading'}
          className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-black transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {generationState.status === 'loading' ? 'Generating...' : 'Generate Darren Five Futures + One Move'}
        </button>
      </div>

      {generationState.status === 'error' && (
        <div className="mt-5 rounded-xl border border-red-400/24 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-50">
          {generationState.error}
        </div>
      )}
      {generationState.status === 'ready' && <GeneratedIntelligence generated={generationState.data} />}
    </section>
  )
}

function generationErrorMessage(error) {
  if (error === 'darren_intelligence_model_not_configured') {
    return 'Darren Five Futures + One Move generation is not configured yet.'
  }
  if (error === 'darren_intelligence_generation_timeout') {
    return 'Darren Five Futures + One Move generation timed out. Try again later.'
  }
  if (error === 'darren_intelligence_generation_failed_privacy_scan') {
    return 'Generated intelligence failed a safety check and was not returned.'
  }
  if (error === 'darren_intelligence_quality_validation_failed') {
    return 'Generated intelligence was too broad for Darren’s weekly operating view and was not returned.'
  }
  return 'Darren Five Futures + One Move generation is unavailable right now.'
}

function GeneratedIntelligence({ generated }) {
  const futures = asArray(generated?.five_futures)
  const oneMove = generated?.one_move || {}

  return (
    <div className="mt-7 space-y-6">
      <PanelBlock eyebrow="Generated Five Futures" title="Your Strategic Futures">
        <div className="grid gap-4 xl:grid-cols-2">
          {futures.map((future) => (
            <GeneratedFutureCard key={future.name} future={future} />
          ))}
        </div>
      </PanelBlock>

      <PanelBlock eyebrow="One Move This Week" title={display(oneMove.title)}>
        <FieldLabel label="Summary" value={oneMove.summary} />
        <FieldLabel label="Why this move" value={oneMove.why_this_move} />
        <FieldLabel label="Exact action" value={oneMove.exact_action} />
        <FieldLabel label="Proof target" value={oneMove.proof_target} />
        <FieldLabel label="Expected signal" value={oneMove.expected_signal} />
        <FieldLabel label="What to say" value={oneMove.what_to_say} />
        <FieldLabel label="What not to say" value={oneMove.what_not_to_say} />
        <FieldLabel label="Timeframe" value={oneMove.timeframe} />
        <FieldLabel label="Success condition" value={oneMove.success_condition} />
      </PanelBlock>

      <div className="grid gap-6 xl:grid-cols-2">
        <PanelBlock eyebrow="Evidence Gaps" title="What Still Needs Proof">
          <ListItems items={asArray(generated?.evidence_gaps)} />
        </PanelBlock>
        <PanelBlock eyebrow="Next Proof Targets" title="Your Next Signals">
          <ListItems items={asArray(generated?.next_proof_targets)} />
        </PanelBlock>
        <PanelBlock eyebrow="What Not To Overclaim" title="Generated Sales Guardrails">
          <ListItems items={asArray(generated?.truth_boundaries)} />
        </PanelBlock>
        <PanelBlock eyebrow="Model Limits" title="Not Yet Proven">
          <ListItems items={asArray(generated?.model_limits)} />
        </PanelBlock>
      </div>
    </div>
  )
}

function GeneratedFutureCard({ future }) {
  return (
    <article className="rounded-xl border border-white/10 bg-black/24 p-4">
      <h4 className="text-lg font-semibold leading-7 text-white">{display(future.name)}</h4>
      <p className="mt-3 text-sm leading-6 text-white/66">{display(future.summary)}</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <FieldLabel label="Current evidence" value={future.current_evidence} />
        <FieldLabel label="Missing evidence" value={future.missing_evidence} />
        <FieldLabel label="Likely bottleneck" value={future.likely_bottleneck} />
        <FieldLabel label="Upside" value={future.upside} />
        <FieldLabel label="Danger" value={future.danger} />
        <FieldLabel label="E->P shift" value={future.e_to_p_shift} />
      </div>
      <FieldLabel label="Your sales story" value={future.sales_story} />
      <FieldLabel label="What makes it more likely" value={future.what_makes_it_more_likely} />
      <FieldLabel label="What would invalidate it" value={future.what_would_invalidate_it} />
      <FieldLabel label="What not to overclaim" value={future.what_not_to_overclaim} />
    </article>
  )
}

function SnapshotState({ title, body, tone = 'default' }) {
  const toneClass = tone === 'error' ? 'border-red-400/20 bg-red-500/10 text-red-50' : 'border-white/10 bg-black/22 text-white'
  return (
    <div className={`mt-7 rounded-2xl border p-5 ${toneClass}`}>
      <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-6 opacity-75">{body}</p>
    </div>
  )
}

function PanelBlock({ eyebrow, title, children }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/24 p-5">
      <div className="text-xs uppercase tracking-[0.22em] text-violet-100/48">{eyebrow}</div>
      <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">{title}</h3>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function FieldLabel({ label, value }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="text-xs uppercase tracking-[0.16em] text-white/36">{label}</div>
      <p className="mt-2 text-sm leading-6 text-white/68">{display(value)}</p>
    </div>
  )
}

function ListItems({ items }) {
  if (!items.length) {
    return <p className="text-sm leading-6 text-white/48">Unavailable</p>
  }

  return (
    <ul className="space-y-2 text-sm leading-6 text-white/62">
      {items.map((item, index) => (
        <li key={`${display(item)}-${index}`} className="flex gap-2 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-200/72" />
          <span>{display(item)}</span>
        </li>
      ))}
    </ul>
  )
}

function ListWithTitle({ title, items, compact = false }) {
  return (
    <div className="mt-5">
      <div className="text-xs uppercase tracking-[0.16em] text-white/36">{title}</div>
      <div className={compact ? 'mt-3' : 'mt-4'}>
        <ListItems items={items} />
      </div>
    </div>
  )
}
