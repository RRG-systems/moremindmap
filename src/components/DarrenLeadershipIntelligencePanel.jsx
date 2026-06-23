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

const SIGNAL_TYPES = [
  ['none', 'None'],
  ['customer_revenue', 'Customer revenue'],
  ['partner_capital', 'Partner capital'],
  ['channel_distribution', 'Channel distribution'],
  ['profile_volume', 'Profile volume'],
  ['assessment_volume', 'Assessment volume'],
  ['RRG_opportunity', 'RRG opportunity'],
  ['follow_up_meeting', 'Follow-up meeting'],
  ['funded_pilot', 'Funded pilot'],
  ['other', 'Other']
]

const SIGNAL_STRENGTHS = [
  ['none', 'None'],
  ['weak', 'Weak'],
  ['early', 'Early'],
  ['moderate', 'Moderate'],
  ['strong', 'Strong'],
  ['validated', 'Validated'],
  ['invalidated', 'Invalidated']
]

const LEDGER_EVENT_TYPES = [
  ['one_move_planned', 'One Move planned'],
  ['one_move_started', 'One Move started'],
  ['one_move_completed', 'One Move completed'],
  ['one_move_skipped', 'One Move skipped'],
  ['one_move_invalidated', 'One Move invalidated'],
  ['result_note_added', 'Result note added'],
  ['partner_signal', 'Partner signal'],
  ['channel_signal', 'Channel signal'],
  ['funding_signal', 'Funding signal'],
  ['revenue_signal', 'Revenue signal'],
  ['proof_target_signal', 'Proof target signal'],
  ['other', 'Other']
]

const LEDGER_EVIDENCE_WEIGHTS = SIGNAL_STRENGTHS

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
    error: '',
    source: ''
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
        loadLatestStrategy()
      } catch (error) {
        if (error.name === 'AbortError') return
        setSnapshotState({
          status: 'error',
          data: null,
          error: 'Darren Intelligence Snapshot unavailable.'
        })
      }
    }

    async function loadLatestStrategy() {
      try {
        const response = await fetch('/api/admin/darren-generated-strategy-latest', {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-Admin-Code': adminCode
          },
          signal: controller.signal
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.ok || !payload.latest_strategy) return

        setGenerationState({
          status: 'ready',
          data: {
            ...payload.latest_strategy,
            persistence: {
              saved: true,
              strategy_id: payload.latest_strategy.strategy_id,
              persistence_version: payload.latest_strategy.persistence_version
            }
          },
          error: '',
          source: 'latest'
        })
      } catch (error) {
        if (error.name === 'AbortError') return
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
          Snapshot-first. Saved strategy when generated. No chat or Outcome Ledger yet.
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

    setGenerationState({ status: 'loading', data: null, error: '', source: '' })

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
          error: generationErrorMessage(payload?.error),
          source: ''
        })
        return
      }

      setGenerationState({ status: 'ready', data: payload, error: '', source: 'generated' })
    } catch {
      setGenerationState({
        status: 'error',
        data: null,
        error: 'Darren Five Futures + One Move generation is unavailable right now.',
        source: ''
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
            Generate and save the actual MMM + RRG Five Futures and this week&apos;s One Move from the current source-labeled snapshot. This is not chat, and it does not record outcomes yet.
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
      {generationState.status === 'ready' && (
        <GeneratedIntelligence
          adminCode={adminCode}
          generated={generationState.data}
          source={generationState.source}
          setGenerationState={setGenerationState}
        />
      )}
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
    return "Generated intelligence was too broad for Darren's weekly operating view and was not returned."
  }
  return 'Darren Five Futures + One Move generation is unavailable right now.'
}

function GeneratedIntelligence({ adminCode, generated, source, setGenerationState }) {
  const futures = asArray(generated?.five_futures)
  const oneMove = generated?.one_move || {}
  const saved = generated?.persistence?.saved === true
  const strategyLabel = source === 'latest' ? 'Latest saved strategy' : 'Generated strategy'

  return (
    <div className="mt-7 space-y-6">
      <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-50/78">
        <span className="font-semibold text-emerald-50">{strategyLabel}.</span>{' '}
        {saved ? "Saved as Darren's latest leadership strategy." : 'Strategy has not been saved.'}{' '}
        Future Outcome Ledger work will compare it against what actually happened.
        {generated?.accepted_status && (
          <span className="block pt-2 text-xs uppercase tracking-[0.16em] text-emerald-100/54">
            Acceptance: {display(generated.accepted_status)} - Outcome: {display(generated.outcome_status)}
          </span>
        )}
      </div>

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
        {generated?.strategy_id && (
          <OneMoveStatusControls
            adminCode={adminCode}
            generated={generated}
            setGenerationState={setGenerationState}
          />
        )}
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

function OneMoveStatusControls({ adminCode, generated, setGenerationState }) {
  const [note, setNote] = useState('')
  const [modifiedText, setModifiedText] = useState(generated.one_move_modified_text || '')
  const [signalType, setSignalType] = useState(generated.result_signal_type || 'none')
  const [signalStrength, setSignalStrength] = useState(generated.result_signal_strength || 'none')
  const [statusMessage, setStatusMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const latestHistory = asArray(generated.status_history).slice(-1)[0]

  async function updateStatus(action) {
    if (!adminCode || !generated.strategy_id || isSaving) return

    setIsSaving(true)
    setStatusMessage('')
    try {
      const response = await fetch('/api/admin/darren-one-move-status', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Admin-Code': adminCode
        },
        body: JSON.stringify({
          strategy_id: generated.strategy_id,
          action,
          note,
          modified_one_move_text: modifiedText,
          result_signal_type: signalType,
          result_signal_strength: signalStrength
        })
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.ok || !payload.updated_strategy) {
        setStatusMessage('One Move status could not be saved.')
        return
      }

      setGenerationState({
        status: 'ready',
        data: {
          ...payload.updated_strategy,
          persistence: {
            saved: true,
            strategy_id: payload.updated_strategy.strategy_id,
            persistence_version: payload.updated_strategy.persistence_version
          }
        },
        error: '',
        source: 'latest'
      })
      setStatusMessage('One Move status saved.')
    } catch {
      setStatusMessage('One Move status could not be saved.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-emerald-300/16 bg-black/24 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-emerald-100/48">One Move Status Tracking</div>
      <p className="mt-3 text-sm leading-6 text-white/62">
        This starts the recursive loop: the system can now remember whether the One Move was accepted and what signal it created. Future Outcome Ledger work will compare this against later snapshots.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <FieldLabel label="Acceptance status" value={generated.accepted_status} />
        <FieldLabel label="Outcome status" value={generated.outcome_status} />
        <FieldLabel label="Signal type" value={generated.result_signal_type || 'none'} />
        <FieldLabel label="Signal strength" value={generated.result_signal_strength || 'none'} />
      </div>

      {latestHistory && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm leading-6 text-white/58">
          Most recent update: {formatListKey(latestHistory.action)} / {formatListKey(latestHistory.outcome_status)}.
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.16em] text-white/38">What happened / what did you learn?</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value.slice(0, 1200))}
            rows={4}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/32 px-3 py-3 text-sm leading-6 text-white outline-none transition focus:border-emerald-200/45"
            placeholder="Add a short result note."
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.16em] text-white/38">Modified One Move text</span>
          <textarea
            value={modifiedText}
            onChange={(event) => setModifiedText(event.target.value.slice(0, 2000))}
            rows={4}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/32 px-3 py-3 text-sm leading-6 text-white outline-none transition focus:border-emerald-200/45"
            placeholder="Use only if Darren is modifying the One Move."
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <SelectField label="Signal type" value={signalType} onChange={setSignalType} options={SIGNAL_TYPES} />
        <SelectField label="Signal strength" value={signalStrength} onChange={setSignalStrength} options={SIGNAL_STRENGTHS} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <StatusButton disabled={isSaving} onClick={() => updateStatus('accept')}>Accept One Move</StatusButton>
        <StatusButton disabled={isSaving} onClick={() => updateStatus('modify')}>Modify</StatusButton>
        <StatusButton disabled={isSaving} onClick={() => updateStatus('mark_planned')}>Mark Planned</StatusButton>
        <StatusButton disabled={isSaving} onClick={() => updateStatus('mark_in_progress')}>Mark In Progress</StatusButton>
        <StatusButton disabled={isSaving} onClick={() => updateStatus('mark_completed')}>Mark Completed</StatusButton>
        <StatusButton disabled={isSaving} onClick={() => updateStatus('mark_skipped')}>Mark Skipped</StatusButton>
        <StatusButton disabled={isSaving} onClick={() => updateStatus('reject')}>Reject</StatusButton>
        <StatusButton disabled={isSaving} onClick={() => updateStatus('add_result_note')}>Save Result Note</StatusButton>
      </div>

      {statusMessage && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white/62">
          {statusMessage}
        </div>
      )}

      <OutcomeLedgerControls adminCode={adminCode} generated={generated} />
    </div>
  )
}

function OutcomeLedgerControls({ adminCode, generated }) {
  const [eventType, setEventType] = useState('one_move_planned')
  const [eventNote, setEventNote] = useState('')
  const [signalType, setSignalType] = useState('none')
  const [signalStrength, setSignalStrength] = useState('none')
  const [evidenceWeight, setEvidenceWeight] = useState('none')
  const [proofTargetName, setProofTargetName] = useState('')
  const [futurePath, setFuturePath] = useState('')
  const [ledgerState, setLedgerState] = useState({ status: 'idle', events: [], message: '' })

  useEffect(() => {
    if (!adminCode || !generated?.strategy_id) return undefined
    const controller = new AbortController()
    loadLedgerEvents(controller.signal)
    return () => controller.abort()
  }, [adminCode, generated?.strategy_id])

  async function loadLedgerEvents(signal) {
    try {
      const response = await fetch(`/api/admin/darren-outcome-ledger-latest?strategy_id=${encodeURIComponent(generated.strategy_id)}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Admin-Code': adminCode
        },
        signal
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) return
      setLedgerState({ status: 'ready', events: asArray(payload.events), message: '' })
    } catch (error) {
      if (error.name === 'AbortError') return
    }
  }

  async function saveLedgerEvent() {
    if (!adminCode || !generated?.strategy_id || ledgerState.status === 'saving') return
    setLedgerState((current) => ({ ...current, status: 'saving', message: '' }))

    try {
      const response = await fetch('/api/admin/darren-outcome-ledger-event', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Admin-Code': adminCode
        },
        body: JSON.stringify({
          strategy_id: generated.strategy_id,
          event_type: eventType,
          event_source: 'admin_dashboard',
          event_note: eventNote,
          signal_type: signalType,
          signal_strength: signalStrength,
          evidence_weight: evidenceWeight,
          proof_target_name: proofTargetName,
          future_path: futurePath
        })
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.ok) {
        setLedgerState((current) => ({ ...current, status: 'error', message: 'Ledger event could not be saved.' }))
        return
      }

      setEventNote('')
      const nextEvents = payload.latest_outcome_event_summary
        ? [payload.latest_outcome_event_summary, ...ledgerState.events].slice(0, 10)
        : ledgerState.events
      setLedgerState({ status: 'ready', events: nextEvents, message: 'Ledger event saved.' })
    } catch {
      setLedgerState((current) => ({ ...current, status: 'error', message: 'Ledger event could not be saved.' }))
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-sky-300/16 bg-sky-400/[0.07] p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-sky-100/48">Outcome Ledger v0</div>
      <p className="mt-3 text-sm leading-6 text-white/62">
        This records what happened as evidence. It does not mean the system has automatically learned yet. Later snapshots will compare these events against future movement.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SelectField label="Event type" value={eventType} onChange={setEventType} options={LEDGER_EVENT_TYPES} />
        <SelectField label="Signal type" value={signalType} onChange={setSignalType} options={SIGNAL_TYPES} />
        <SelectField label="Signal strength" value={signalStrength} onChange={setSignalStrength} options={SIGNAL_STRENGTHS} />
        <SelectField label="Evidence weight" value={evidenceWeight} onChange={setEvidenceWeight} options={LEDGER_EVIDENCE_WEIGHTS} />
        <TextInput label="Proof target" value={proofTargetName} onChange={setProofTargetName} maxLength={240} />
        <TextInput label="Future path" value={futurePath} onChange={setFuturePath} maxLength={240} />
      </div>

      <label className="mt-4 block">
        <span className="text-xs uppercase tracking-[0.16em] text-white/38">Ledger note</span>
        <textarea
          value={eventNote}
          onChange={(event) => setEventNote(event.target.value.slice(0, 1200))}
          rows={4}
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/32 px-3 py-3 text-sm leading-6 text-white outline-none transition focus:border-sky-200/45"
          placeholder="Record what happened as evidence."
        />
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <StatusButton disabled={ledgerState.status === 'saving'} onClick={saveLedgerEvent}>Save Ledger Event</StatusButton>
        {ledgerState.message && <span className="text-sm leading-6 text-white/58">{ledgerState.message}</span>}
      </div>

      <div className="mt-5">
        <div className="text-xs uppercase tracking-[0.16em] text-white/36">Latest ledger events</div>
        {!ledgerState.events.length && (
          <p className="mt-3 text-sm leading-6 text-white/48">No ledger events recorded yet.</p>
        )}
        {!!ledgerState.events.length && (
          <div className="mt-3 space-y-2">
            {ledgerState.events.slice(0, 5).map((event, index) => (
              <div key={`${event.event_id || index}-${event.created_at || index}`} className="rounded-xl border border-white/10 bg-black/24 px-4 py-3">
                <div className="flex flex-col gap-1 text-xs uppercase tracking-[0.13em] text-sky-100/48 md:flex-row md:items-center md:justify-between">
                  <span>{formatListKey(event.event_type)}</span>
                  <span>{display(event.created_at)}</span>
                </div>
                <div className="mt-2 text-sm leading-6 text-white/62">
                  {formatListKey(event.signal_type)} / {formatListKey(event.signal_strength)} / {formatListKey(event.evidence_weight)}
                </div>
                {event.note_preview && (
                  <p className="mt-2 text-sm leading-6 text-white/52">{event.note_preview}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <SinceLastSnapshotPanel adminCode={adminCode} />
    </div>
  )
}

function SinceLastSnapshotPanel({ adminCode }) {
  const [comparisonState, setComparisonState] = useState({
    status: 'loading',
    data: null,
    error: ''
  })

  useEffect(() => {
    if (!adminCode) return undefined
    const controller = new AbortController()

    async function loadComparison() {
      setComparisonState({ status: 'loading', data: null, error: '' })
      try {
        const response = await fetch('/api/admin/darren-since-last-snapshot', {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-Admin-Code': adminCode
          },
          signal: controller.signal
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.ok) {
          setComparisonState({ status: 'error', data: null, error: 'Since Last Snapshot is unavailable.' })
          return
        }
        setComparisonState({ status: 'ready', data: payload, error: '' })
      } catch (error) {
        if (error.name === 'AbortError') return
        setComparisonState({ status: 'error', data: null, error: 'Since Last Snapshot is unavailable.' })
      }
    }

    loadComparison()
    return () => controller.abort()
  }, [adminCode])

  if (comparisonState.status === 'loading') {
    return (
      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/54">
        Loading Since Last Snapshot.
      </div>
    )
  }

  if (comparisonState.status === 'error') {
    return (
      <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm leading-6 text-red-50">
        {comparisonState.error}
      </div>
    )
  }

  const comparison = comparisonState.data || {}
  const changes = comparison.changes_since_last_strategy || {}
  const movement = comparison.future_path_movement_v0 || {}
  const ledger = comparison.outcome_ledger_summary || {}
  const oneMove = comparison.one_move_status || {}

  return (
    <div className="mt-6 rounded-2xl border border-cyan-300/16 bg-cyan-400/[0.07] p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/48">Since Last Snapshot</div>
      <p className="mt-3 text-sm leading-6 text-white/66">{display(comparison.safe_summary)}</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FieldLabel label="One Move status" value={`${display(oneMove.accepted_status)} / ${display(oneMove.outcome_status)}`} />
        <FieldLabel label="Latest status action" value={oneMove.latest_status_action} />
        <FieldLabel label="Ledger events" value={ledger.outcome_event_count} />
        <FieldLabel label="Future movement" value={changes.future_movement_supported ? 'Supported by evidence' : 'Unchanged'} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-white/36">What changed</div>
          <ListItems items={[
            `One Move status changed: ${changes.one_move_status_changed ? 'yes' : 'no'}`,
            `Outcome event added: ${changes.outcome_event_added ? 'yes' : 'no'}`,
            `Evidence added: ${changes.evidence_added ? 'yes' : 'no'}`,
            `Strong evidence added: ${changes.strong_evidence_added ? 'yes' : 'no'}`,
            `Validated evidence added: ${changes.validated_evidence_added ? 'yes' : 'no'}`
          ]} />
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-white/36">Future movement status</div>
          <p className="mt-3 text-sm leading-6 text-white/62">{display(movement.movement_summary)}</p>
          <p className="mt-3 text-sm leading-6 text-white/48">{display(movement.reason)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-white/36">Still missing</div>
          <ListItems items={asArray(comparison.still_missing)} />
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-white/36">Next best prompt</div>
          <p className="mt-3 text-sm leading-6 text-white/62">{display(comparison.next_best_prompt)}</p>
          <ListWithTitle title="Do not claim yet" items={asArray(comparison.not_yet_claims).slice(0, 4)} compact />
        </div>
      </div>
    </div>
  )
}

function TextInput({ label, value, onChange, maxLength }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.16em] text-white/38">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, maxLength))}
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/32 px-3 py-3 text-sm text-white outline-none transition focus:border-sky-200/45"
      />
    </label>
  )
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.16em] text-white/38">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/32 px-3 py-3 text-sm text-white outline-none transition focus:border-emerald-200/45"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  )
}

function StatusButton({ children, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-xl border border-white/10 bg-white/[0.08] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/72 transition hover:border-emerald-200/36 hover:bg-emerald-300/12 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
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
