import React from 'react';
import ReactDOM from 'react-dom/client';

import BusinessMapApp from './BusinessMapApp.jsx';
import { loadCanonicalPatriciaBusinessMap } from './loadCanonicalPatriciaBusinessMap.js';
import './styles.css';

async function mount() {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  if (String(import.meta.env.VITE_BA_CUSTOMER_REALIZATION_LAB_V1).toLowerCase() !== 'true') {
    root.render(<main className="lab-disabled" aria-label="Lab disabled" />);
    return;
  }
  try {
    const { viewModel } = await loadCanonicalPatriciaBusinessMap();
    document.title = 'Patricia’s Business Map · MORE MindMap';
    root.render(<React.StrictMode><BusinessMapApp viewModel={viewModel} /></React.StrictMode>);
  } catch (error) {
    console.error('BA_CUSTOMER_REALIZATION_LAB_FAIL_CLOSED', error?.code || error?.message);
    root.render(
      <main className="integrity-stop" role="alert">
        <p>Business Map unavailable</p>
        <h1>The frozen assessment could not be verified.</h1>
        <span>No customer experience was rendered.</span>
      </main>,
    );
  }
}

mount();
