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
import LeadershipSalesDashboard from './components/LeadershipSalesDashboard.jsx'
import BusinessAssessment from './BusinessAssessment.jsx'
import BusinessAssessmentVisualMap from './BusinessAssessmentVisualMap.jsx'
import BusinessAssessmentFiveFutures from './BusinessAssessmentFiveFutures.jsx'
import PaymentSuccess from './PaymentSuccess.jsx'
import PaymentCancelled from './PaymentCancelled.jsx'
import VisualLabPage from './components/visualLab/VisualLabPage.jsx'
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
        <Route path="/leadership-dashboard" element={<LeadershipSalesDashboard />} />
        <Route path="/business-assessment" element={<BusinessAssessment />} />
        <Route path="/business-assessment/visual-map" element={<BusinessAssessmentVisualMap />} />
        <Route path="/business-assessment/five-futures" element={<BusinessAssessmentFiveFutures />} />
        <Route path="/visual-lab" element={<VisualLabPage />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/payment-cancelled" element={<PaymentCancelled />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
