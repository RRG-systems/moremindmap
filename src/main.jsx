import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import RealEstate from './RealEstate.jsx'
import Profile from './Profile.jsx'
import Recovery from './Recovery.jsx'
import Success from './Success.jsx'
import VisualDNAPreview from './VisualDNAPreview.jsx'
import LeadershipPortal from './LeadershipPortal.jsx'
import LeadershipDemo from './LeadershipDemo.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/real-estate" element={<RealEstate />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/recovery" element={<Recovery />} />
        <Route path="/success" element={<Success />} />
        <Route path="/visual-dna-preview" element={<VisualDNAPreview />} />
        <Route path="/leadership" element={<LeadershipPortal />} />
        <Route path="/leadership-demo" element={<LeadershipDemo />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
