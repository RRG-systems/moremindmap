import React from 'react'
import ReactDOM from 'react-dom/client'
import LivingBusinessRelationshipApp from './LivingBusinessRelationshipApp.jsx'
import '../baProgressiveDisclosureV1/styles.css'
import './styles.css'

async function mount() {
  const root = ReactDOM.createRoot(document.getElementById('root'))
  if (String(import.meta.env.VITE_SUBSCRIPTION_V1_AFW05_06_LAB).toLowerCase() !== 'true') {
    root.render(<main className="lab-disabled" aria-label="Subscription V1 AFW-05 and AFW-06 lab is disabled" />)
    return
  }
  try {
    const { createSyntheticLivingRelationshipLab } = await import('./createSyntheticLivingRelationshipLab.js')
    const params = new URLSearchParams(globalThis.location.search)
    const requestedSession = params.get('session') === 'weekly' ? 'WEEKLY' : 'FIRST_EVER'
    const requestedProfile = params.get('profile') || 're-mid'
    const liveProvider = String(import.meta.env.VITE_SUBSCRIPTION_V1_LIVE_FRONTIER_DEMO).toLowerCase() === 'true'
    const lab = await createSyntheticLivingRelationshipLab({ product_proof_sequence: !liveProvider, live_provider: liveProvider, session_kind: requestedSession, subject_key: requestedProfile })
    document.title = 'Living Business Relationship · MORE MindMap'
    root.render(<React.StrictMode><LivingBusinessRelationshipApp controller={lab.controller} demo={lab} /></React.StrictMode>)
  } catch (error) {
    console.error('SUBSCRIPTION_V1_AFW05_06_FAIL_CLOSED', error?.message)
    root.render(<main className="integrity-stop" role="alert"><p>Living Business Twin unavailable</p><h1>The governed current state could not be verified.</h1><span>No conversation or customer state was opened.</span></main>)
  }
}

mount()
