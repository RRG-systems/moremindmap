import React from 'react'
import ReactDOM from 'react-dom/client'

import BaV2CustomerRealizationApp from './BaV2CustomerRealizationApp.jsx'
import { buildSyntheticGeneralizationCandidate } from './buildSyntheticGeneralizationCandidate.js'
import './styles.css'

async function mount() {
  const root = ReactDOM.createRoot(document.getElementById('root'))
  if (String(import.meta.env.VITE_BA_V2_CUSTOMER_REALIZATION_RUN3).toLowerCase() !== 'true') {
    root.render(<main className="lab-disabled" aria-label="Run 3 disabled" />)
    return
  }
  try {
    const candidate = new URLSearchParams(globalThis.location.search).get('candidate')
    const projection = candidate === 'synthetic-mid'
      ? buildSyntheticGeneralizationCandidate('mid')
      : candidate === 'synthetic-top'
        ? buildSyntheticGeneralizationCandidate('top')
        : await import('./loadPatriciaBaV2Realization.js').then(({ loadPatriciaBaV2Realization }) => loadPatriciaBaV2Realization())
    const { viewModel } = projection
    document.title = `${viewModel.identity.firstName}’s Business Twin · MORE MindMap`
    root.render(<React.StrictMode><BaV2CustomerRealizationApp viewModel={viewModel} /></React.StrictMode>)
  } catch (error) {
    console.error('BA_V2_RUN3_FAIL_CLOSED', error?.message)
    root.render(
      <main className="integrity-stop" role="alert">
        <p>Business Twin unavailable</p>
        <h1>The governed business state could not be verified.</h1>
        <span>No customer realization was rendered.</span>
      </main>,
    )
  }
}

mount()
