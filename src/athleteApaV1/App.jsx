import React, { useEffect, useMemo } from 'react'
import BusinessTwinApp from '../lab/baProgressiveDisclosureV1/BusinessTwinApp.jsx'
import { ATHLETE_APA_PARITY_V1 } from '../lib/athleteApaV1/parityProjection.js'
import { loadCurrentBaReference } from './loadCurrentBaReference.js'
import '../lab/baProgressiveDisclosureV1/styles.css'
import '../components/baProductionReadinessV1/newBaProductionCanary.css'
import './styles.css'

function ReferenceLoading() {
  return <main className="apa-parity-loading"><p className="eyebrow green">Current Business Twin reference</p><h1>Loading the exact shared BA chassis…</h1><p>No live profile, provider, persistence, or customer route is contacted.</p></main>
}

export default function AthleteApaV1App() {
  const params = new URLSearchParams(globalThis.location?.search || '')
  const showBaReference = params.get('view') === 'ba'
  const baReference = useMemo(() => showBaReference ? loadCurrentBaReference().customerViewModel : null, [showBaReference])

  useEffect(() => {
    document.title = showBaReference ? 'Current Business Twin reference · MORE' : 'Mika’s Athlete Performance Map · MORE Athlete'
  }, [showBaReference])

  if (showBaReference) return baReference ? <div className="new-ba-production-experience"><BusinessTwinApp viewModel={baReference} /></div> : <ReferenceLoading />
  return <div className="athlete-apa-parity-root" data-contract="athlete-apa-live-ba-parity-v1" data-realization={ATHLETE_APA_PARITY_V1.realizationIdentity}>
    <BusinessTwinApp viewModel={ATHLETE_APA_PARITY_V1.customerViewModel} />
  </div>
}
