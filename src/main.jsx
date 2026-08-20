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
import LeadershipRoleFitLab from './LeadershipRoleFitLab.jsx'
import BusinessAssessment from './BusinessAssessment.jsx'
import BusinessAssessmentVisualMap from './BusinessAssessmentVisualMap.jsx'
import BusinessAssessmentFiveFutures from './BusinessAssessmentFiveFutures.jsx'
import PaymentSuccess from './PaymentSuccess.jsx'
import PaymentCancelled from './PaymentCancelled.jsx'
import VisualLabPage from './components/visualLab/VisualLabPage.jsx'
import BOSRegressionViewer from './lab/BOSRegressionViewer.jsx'
import BACustomerShellLab from './lab/BACustomerShellLab.jsx'
import SubscriptionV1InternalDevApp from './subscriptionV1/SubscriptionV1InternalDevApp.jsx'
import './index.css'

const newBosProductionRenderEnabled = import.meta.env.VITE_NEW_BOS_PRODUCTION_RENDER_ENABLED === 'true'
const NewBosProductionCanary = newBosProductionRenderEnabled
  ? React.lazy(() => import('./components/newBosPersonalityDnaV1/NewBosProductionCanary.jsx'))
  : null
const newBaProductionRenderEnabled = import.meta.env.VITE_NEW_BA_PRODUCTION_RENDER_ENABLED === 'true'
const NewBaProductionCanary = newBaProductionRenderEnabled
  ? React.lazy(() => import('./components/baProductionReadinessV1/NewBaProductionCanary.jsx'))
  : null

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
        <Route path="/leadership/role-fit" element={<LeadershipRoleFitLab />} />
        <Route path="/leadership/fathom-dd-fit" element={<LeadershipRoleFitLab />} />
        <Route path="/subscription" element={<SubscriptionV1InternalDevApp />} />
        <Route path="/business-assessment" element={<BusinessAssessment />} />
        <Route path="/business-assessment/visual-map" element={<BusinessAssessmentVisualMap />} />
        <Route path="/business-assessment/five-futures" element={<BusinessAssessmentFiveFutures />} />
        <Route path="/visual-lab" element={<VisualLabPage />} />
        <Route path="/visual-lab/bos-regression" element={<BOSRegressionViewer />} />
        <Route path="/visual-lab/ba-shell" element={<BACustomerShellLab />} />
        {newBosProductionRenderEnabled && (
          <Route
            path="/new-bos"
            element={<React.Suspense fallback={null}><NewBosProductionCanary customerMode /></React.Suspense>}
          />
        )}
        {newBosProductionRenderEnabled && (
          <Route
            path="/private/new-bos-canary"
            element={<React.Suspense fallback={null}><NewBosProductionCanary /></React.Suspense>}
          />
        )}
        {newBaProductionRenderEnabled && (
          <Route
            path="/business-twin"
            element={<React.Suspense fallback={null}><NewBaProductionCanary customerMode /></React.Suspense>}
          />
        )}
        {newBaProductionRenderEnabled && (
          <Route
            path="/private/new-ba-canary"
            element={<React.Suspense fallback={null}><NewBaProductionCanary /></React.Suspense>}
          />
        )}
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/payment-cancelled" element={<PaymentCancelled />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
