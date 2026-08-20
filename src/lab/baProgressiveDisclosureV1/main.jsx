import React from 'react'
import ReactDOM from 'react-dom/client'

import BusinessTwinApp from './BusinessTwinApp.jsx'
import './styles.css'

async function mount() {
  const root = ReactDOM.createRoot(document.getElementById('root'))
  if (String(import.meta.env.VITE_BA_PROGRESSIVE_DISCLOSURE_V1).toLowerCase() !== 'true') {
    root.render(<main className="lab-disabled" aria-label="Progressive Disclosure V1 is disabled" />)
    return
  }
  try {
    const candidate = new URLSearchParams(globalThis.location.search).get('candidate') || 'patricia'
    const realization = await import('./loadBaProgressiveDisclosureV1.js').then(({ loadBaProgressiveDisclosureV1 }) => loadBaProgressiveDisclosureV1(candidate))
    document.title = `${realization.customerViewModel.identity.firstName}’s Business Twin · MORE MindMap`
    root.render(<React.StrictMode><BusinessTwinApp viewModel={realization.customerViewModel} /></React.StrictMode>)
  } catch (error) {
    console.error('BA_PROGRESSIVE_DISCLOSURE_V1_FAIL_CLOSED', error?.message)
    root.render(<main className="integrity-stop" role="alert"><p>Business Twin unavailable</p><h1>The accepted business state could not be verified.</h1><span>No customer realization was rendered.</span></main>)
  }
}

mount()
