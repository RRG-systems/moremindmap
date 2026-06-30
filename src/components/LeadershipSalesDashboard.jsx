import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { leadershipBuildMap } from '../data/leadershipBuildMap'
import DarrenLeadershipIntelligencePanel from './DarrenLeadershipIntelligencePanel'
import LeadershipAppStackPanel from './dashboard/LeadershipAppStackPanel.jsx'

const DASHBOARD_CODE_SESSION_KEY = 'leadershipDashboardCode'
const DASHBOARD_ACCESS_SESSION_KEY = 'leadershipDashboardAccess'

function display(value) {
  if (value === null || value === undefined || value === '') return 'Unavailable'
  return String(value)
}

function displayMissing(value) {
  if (value === null || value === undefined || value === '') return 'Missing'
  return String(value)
}

function formatDate(value) {
  if (!value) return 'Unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return display(value)
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatNumber(value) {
  if (value === null || value === undefined || value === 'unavailable') return 'Unavailable'
  if (typeof value === 'number') return value.toLocaleString()
  const parsed = Number(value)
  if (Number.isFinite(parsed)) return parsed.toLocaleString()
  return display(value)
}

function normalizeCompany(value) {
  const raw = String(value || '').trim()
  if (!raw || /^unavailable$/i.test(raw) || /^unknown/i.test(raw)) return 'Missing Company Data'

  const cleaned = raw
    .replace(/\s+/g, ' ')
    .replace(/\s*,?\s*llc\.?$/i, '')
    .trim()
  const normalized = cleaned.toLowerCase()

  if (normalized === 'fathom realty') return 'Fathom Realty'
  if (normalized === 'fathom realty nc') return 'Fathom Realty NC'
  if (normalized === 'fathom realty mt') return 'Fathom Realty MT'
  if (normalized === 'the more companies' || normalized === 'the more company') return 'The MORE Companies'

  return cleaned || 'Missing Company Data'
}

function isSafelyDetectableTestRecord(record) {
  const name = String(record?.name || '').toLowerCase()
  const email = String(record?.email || '').toLowerCase()
  const company = String(record?.company || '').toLowerCase()

  return (
    email.includes('example.invalid') ||
    /\bqa\b/.test(name) ||
    company.includes('qa synthetic') ||
    company.includes('diagnostic test') ||
    name.includes('smoke test') ||
    email.includes('smoke test') ||
    name.includes('synthetic fixture') ||
    email.includes('synthetic fixture')
  )
}

function normalizeProfileRow(profile) {
  return {
    ...profile,
    display_company: normalizeCompany(profile?.company)
  }
}

function normalizeAssessmentRow(assessment) {
  return {
    ...assessment,
    display_company: normalizeCompany(assessment?.company)
  }
}

function buildNormalizedCompanyRows(profileRows, assessmentRows) {
  const companies = new Map()

  for (const profile of profileRows) {
    const company = profile.display_company || normalizeCompany(profile.company)
    if (!companies.has(company)) {
      companies.set(company, { company, profile_count: 0, assessment_count: 0 })
    }
    companies.get(company).profile_count += 1
  }

  for (const assessment of assessmentRows) {
    const company = assessment.display_company || normalizeCompany(assessment.company)
    if (!companies.has(company)) {
      companies.set(company, { company, profile_count: 0, assessment_count: 0 })
    }
    companies.get(company).assessment_count += 1
  }

  return [...companies.values()]
    .sort((a, b) => b.profile_count + b.assessment_count - (a.profile_count + a.assessment_count))
    .slice(0, 100)
}

function recordDarrenUsageEvent(adminCode, event) {
  if (!adminCode || !event?.event_type) return
  fetch('/api/admin/darren-usage-event', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Admin-Code': adminCode
    },
    body: JSON.stringify({
      subject_id: event.subject_id,
      event_type: event.event_type,
      event_source: event.event_source || 'leadership_sales_dashboard_frontend',
      panel_id: event.panel_id,
      action_id: event.action_id,
      metadata: event.metadata || {}
    })
  }).catch(() => {})
}

export default function LeadershipSalesDashboard() {
  const [dashboardState, setDashboardState] = useState({
    status: 'loading',
    data: null,
    error: ''
  })
  const [adminCode, setAdminCode] = useState('')

  const hasAccess = useMemo(
    () => sessionStorage.getItem(DASHBOARD_ACCESS_SESSION_KEY) === 'true',
    []
  )

  useEffect(() => {
    if (!hasAccess) {
      setDashboardState({
        status: 'locked',
        data: null,
        error: 'Enter the admin access code through the Leadership Portal.'
      })
      return undefined
    }

    const adminCode = sessionStorage.getItem(DASHBOARD_CODE_SESSION_KEY)
    if (!adminCode) {
      setDashboardState({
        status: 'locked',
        data: null,
        error: 'Admin dashboard access was not found for this session.'
      })
      return undefined
    }
    setAdminCode(adminCode)

    const controller = new AbortController()

    async function loadDashboard() {
      setDashboardState({ status: 'loading', data: null, error: '' })

      try {
        const response = await fetch('/api/admin/sales-dashboard', {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-Admin-Code': adminCode
          },
          signal: controller.signal
        })
        const payload = await response.json().catch(() => null)

        if (response.status === 403) {
          sessionStorage.removeItem(DASHBOARD_ACCESS_SESSION_KEY)
          sessionStorage.removeItem(DASHBOARD_CODE_SESSION_KEY)
          setDashboardState({
            status: 'denied',
            data: null,
            error: 'Admin dashboard access was not recognized.'
          })
          return
        }

        if (!response.ok || !payload?.ok) {
          setDashboardState({
            status: 'error',
            data: null,
            error: 'The dashboard API is unavailable right now.'
          })
          return
        }

        setDashboardState({ status: 'ready', data: payload, error: '' })
      } catch (error) {
        if (error.name === 'AbortError') return
        setDashboardState({
          status: 'error',
          data: null,
          error: 'The dashboard API is unavailable right now.'
        })
      }
    }

    loadDashboard()

    return () => controller.abort()
  }, [hasAccess])

  if (dashboardState.status === 'locked' || dashboardState.status === 'denied') {
    return <DashboardLocked message={dashboardState.error} />
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <DashboardBackground />
      <DashboardHeader data={dashboardState.data} />

      <main className="relative z-10 mx-auto max-w-7xl px-6 py-10">
        {dashboardState.status === 'loading' && <StatePanel title="Loading dashboard" body="Retrieving read-only leadership sales visibility." />}
        {dashboardState.status === 'error' && <StatePanel title="Dashboard unavailable" body={dashboardState.error} tone="error" />}
        {dashboardState.status === 'ready' && <DashboardContent data={dashboardState.data} adminCode={adminCode} />}
      </main>
    </div>
  )
}

function DashboardHeader({ data }) {
  return (
    <header className="relative z-10 border-b border-white/10 bg-black/40 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-6 md:flex-row md:items-center md:justify-between">
        <div>
          <Link to="/" className="text-lg font-semibold tracking-wide md:text-xl">
            MoreMindMap
          </Link>
          <div className="mt-5 inline-flex rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-emerald-100">
            V1 Read-Only
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">
            MORE MindMap Leadership Sales Dashboard
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-white/62 md:text-lg">
            Internal sales visibility for MORE MindMap V1
          </p>
          <p className="mt-3 text-sm text-white/45">
            Generated: {formatDate(data?.generated_at)}
          </p>
        </div>
        <Link
          to="/leadership"
          className="inline-flex items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/72 transition hover:bg-white/10 hover:text-white"
        >
          Leadership Portal
        </Link>
      </div>
    </header>
  )
}

function DashboardContent({ data, adminCode }) {
  const summary = data?.summary || {}
  const sourceLabels = data?.source_labels || {}
  const rawProfiles = Array.isArray(data?.profiles) ? data.profiles : []
  const rawAssessments = Array.isArray(data?.business_assessments) ? data.business_assessments : []
  const profiles = rawProfiles.filter((profile) => !isSafelyDetectableTestRecord(profile)).map(normalizeProfileRow)
  const assessments = rawAssessments.filter((assessment) => !isSafelyDetectableTestRecord(assessment)).map(normalizeAssessmentRow)
  const companies = buildNormalizedCompanyRows(profiles, assessments)
  const notes = Array.isArray(data?.missing_data_notes) ? data.missing_data_notes : []
  const limits = Array.isArray(data?.limits) ? data.limits : []
  const hiddenTestRecordsCount = rawProfiles.length + rawAssessments.length - profiles.length - assessments.length
  const trackPanelToggle = ({ isOpen, panelId, title }) => {
    recordDarrenUsageEvent(adminCode, {
      event_type: isOpen ? 'panel_opened' : 'panel_collapsed',
      panel_id: panelId,
      metadata: { title }
    })
  }

  useEffect(() => {
    recordDarrenUsageEvent(adminCode, {
      event_type: 'dashboard_opened',
      panel_id: 'leadership_dashboard',
      metadata: {
        profiles_displayed: profiles.length,
        assessments_displayed: assessments.length,
        companies_displayed: companies.length
      }
    })
  }, [])

  return (
    <div className="space-y-10">
      <DarrenLeadershipIntelligencePanel adminCode={adminCode} />

      <LeadershipAppStackPanel
        title="Financial/Admin Data"
        telemetryId="financial_admin_data"
        onToggle={trackPanelToggle}
        eyebrow="Collapsed Admin"
        badge="Admin"
        description="Financial Reality and adoption evidence: profile/assessment counts, company adoption, and revenue availability boundaries."
        summary="Sales Visibility, summary counters, Company Adoption, and unavailable revenue fields."
      >
        <SalesContextPanel
          profilesDisplayed={profiles.length}
          assessmentsDisplayed={assessments.length}
          hiddenTestRecordsCount={hiddenTestRecordsCount}
        />

        <SummaryGrid
          summary={summary}
          companiesCount={companies.length}
          notesCount={notes.length}
          sourceLabels={sourceLabels}
          profilesDisplayed={profiles.length}
          assessmentsDisplayed={assessments.length}
        />

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <CompaniesSection companies={companies} />
          <UnavailablePanel summary={summary} />
        </div>
      </LeadershipAppStackPanel>

      <LeadershipAppStackPanel
        title="Raw Profiles / Assessments / Adoption Records"
        telemetryId="raw_profiles_assessments_adoption_records"
        onToggle={trackPanelToggle}
        eyebrow="Collapsed Admin"
        badge="Records"
        description="Raw admin evidence rows. These feed visibility and follow-up, but they are not the primary Darren-facing intelligence surface."
        summary="Behavior Profiles table and Business Assessments table."
      >
        <ProfilesTable profiles={profiles} />
        <AssessmentsTable assessments={assessments} />
      </LeadershipAppStackPanel>

      <LeadershipAppStackPanel
        title="Build Map / Roadmap"
        telemetryId="build_map_roadmap"
        onToggle={trackPanelToggle}
        eyebrow="Collapsed Admin"
        badge="Roadmap"
        description="Planning context and build truth. Kept available, but no longer allowed to dominate the dashboard surface."
        summary="Strategic Build Map, roadmap phases, V1 truth boundary, missing data notes, and API limits."
      >
        <StrategicBuildMapSection />
        <div className="mt-6">
          <NotesAndLimits notes={notes} limits={limits} />
        </div>
      </LeadershipAppStackPanel>
    </div>
  )
}

function SalesContextPanel({ profilesDisplayed, assessmentsDisplayed, hiddenTestRecordsCount }) {
  return (
    <section className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-6">
      <div className="text-xs uppercase tracking-[0.24em] text-emerald-100/70">Sales Visibility</div>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
        Real V1 activity for follow-up and adoption conversations
      </h2>
      <p className="mt-3 max-w-5xl text-sm leading-6 text-emerald-50/76">
        This dashboard shows real V1 profile and assessment activity, company adoption signals, and follow-up targets. Paid/free/revenue and RRG readiness remain unavailable until those systems are persistently indexed.
      </p>
      <div className="mt-5 grid gap-3 text-sm text-white/68 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
          Displayed profiles: <span className="font-semibold text-white">{formatNumber(profilesDisplayed)}</span>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
          Displayed assessments: <span className="font-semibold text-white">{formatNumber(assessmentsDisplayed)}</span>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
          QA/test rows hidden: <span className="font-semibold text-white">{formatNumber(hiddenTestRecordsCount)}</span>
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-emerald-50/58">
        Internal QA/test records are hidden from the default sales view when safely detectable. Backend totals remain sourced totals.
      </p>
    </section>
  )
}

function SummaryGrid({ summary, companiesCount, notesCount, sourceLabels, profilesDisplayed, assessmentsDisplayed }) {
  const cards = [
    {
      label: 'Total Behavior Profiles',
      value: formatNumber(summary.total_profiles),
      source: sourceLabels.total_profiles
    },
    {
      label: 'Total Business Assessments',
      value: formatNumber(summary.total_business_assessments),
      source: sourceLabels.total_business_assessments
    },
    {
      label: 'Profiles This Month',
      value: formatNumber(summary.profiles_this_month),
      source: sourceLabels.profiles_this_month
    },
    {
      label: 'Business Assessments This Month',
      value: formatNumber(summary.business_assessments_this_month),
      source: sourceLabels.business_assessments_this_month
    },
    {
      label: 'Companies Represented',
      value: formatNumber(companiesCount),
      source: 'normalized_display_sales_view'
    },
    {
      label: 'Missing Data Notes',
      value: formatNumber(notesCount),
      source: 'visible_v1_limits'
    },
    {
      label: 'Displayed Sales Profiles',
      value: formatNumber(profilesDisplayed),
      source: 'filtered_sales_view'
    },
    {
      label: 'Displayed Sales Assessments',
      value: formatNumber(assessmentsDisplayed),
      source: 'filtered_sales_view'
    }
  ]

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl border border-white/10 bg-white/[0.055] p-5 shadow-[0_18px_70px_rgba(0,0,0,0.28)] backdrop-blur-md">
          <div className="text-xs uppercase tracking-[0.2em] text-white/42">{card.label}</div>
          <div className="mt-4 text-3xl font-semibold tracking-tight text-white">{card.value}</div>
          <div className="mt-4 text-xs text-white/40">Source: {display(card.source)}</div>
        </div>
      ))}
    </section>
  )
}

function StrategicBuildMapSection() {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-sky-100/58">Strategic Build Map</div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
            From V1 assessment intelligence to leadership intelligence
          </h2>
          <p className="mt-3 max-w-5xl text-sm leading-6 text-white/62">
            V1 proves assessment intelligence. The roadmap turns that intelligence into paid access, recursive coaching, recruiting intelligence, RRG opportunity, and eventually runtime leadership detection.
          </p>
        </div>
        <div className="rounded-xl border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-xs leading-5 text-sky-50/70 md:max-w-xs">
          Repo-backed roadmap. Future sprints can update this source file as phases move from planned to live.
        </div>
      </div>

      <div className="mt-7 grid gap-4 lg:grid-cols-3">
        {leadershipBuildMap.map((phase) => (
          <BuildMapCard key={phase.id} phase={phase} />
        ))}
      </div>
    </section>
  )
}

function BuildMapCard({ phase }) {
  const status = getBuildMapStatus(phase.status)

  return (
    <article className="flex h-full flex-col rounded-2xl border border-white/10 bg-black/28 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-white/38">{phase.dateRange}</div>
          <h3 className="mt-2 text-lg font-semibold leading-7 text-white">{phase.title}</h3>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${status.className}`}>
          {status.label}
        </span>
      </div>

      <div className="mt-4 text-sm font-medium text-sky-100/82">{phase.label}</div>
      <ul className="mt-4 space-y-2 text-sm leading-6 text-white/62">
        {phase.bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-200/70" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-3 border-t border-white/10 pt-4 text-xs leading-5">
        <p className="text-white/58">
          <span className="font-semibold text-white/78">Sales meaning: </span>
          {phase.salesMeaning}
        </p>
        <p className="text-white/50">
          <span className="font-semibold text-white/72">Current truth: </span>
          {phase.currentTruth}
        </p>
        <p className="text-white/42">
          <span className="font-semibold text-white/64">Limit: </span>
          {phase.limits}
        </p>
      </div>
    </article>
  )
}

function getBuildMapStatus(status) {
  if (status === 'live') {
    return {
      label: 'Live',
      className: 'border-emerald-300/30 bg-emerald-400/12 text-emerald-100'
    }
  }

  if (status === 'in_progress') {
    return {
      label: 'In Progress',
      className: 'border-sky-300/30 bg-sky-400/12 text-sky-100'
    }
  }

  if (status === 'planned') {
    return {
      label: 'Planned',
      className: 'border-amber-300/30 bg-amber-400/12 text-amber-100'
    }
  }

  if (status === 'blocked') {
    return {
      label: 'Blocked',
      className: 'border-red-300/30 bg-red-400/12 text-red-100'
    }
  }

  return {
    label: 'Future',
    className: 'border-white/15 bg-white/[0.06] text-white/58'
  }
}

function UnavailablePanel({ summary }) {
  const status = summary?.paid_free_promo_status
  const note = status?.note || 'Paid/free/promo and revenue totals are not available until access source and payment fields are persistently indexed.'

  return (
    <section className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-6">
      <div className="text-xs uppercase tracking-[0.24em] text-amber-100/70">Unavailable Revenue Fields</div>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
        Paid/free/promo and revenue totals are unavailable
      </h2>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-amber-50/72">{note}</p>
    </section>
  )
}

function CompaniesSection({ companies }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.05] p-6">
      <SectionHeading eyebrow="Company Adoption" title="Companies Represented" />
      <p className="mt-3 text-xs leading-5 text-white/45">
        Company names are normalized for dashboard display only. Stored records are not changed.
      </p>
      {companies.length === 0 ? (
        <EmptyState message="No company rows were returned by the dashboard API." />
      ) : (
        <div className="mt-5 space-y-3">
          {companies.map((company, index) => (
            <div key={`${company.company || 'company'}-${index}`} className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-black/30 px-4 py-3">
              <div>
                <div className="font-medium text-white">{displayMissing(company.company)}</div>
                <div className="mt-1 text-xs text-white/42">Normalized display grouping from sales-view rows</div>
              </div>
              <div className="flex shrink-0 gap-4 text-right text-sm">
                <div>
                  <div className="font-semibold text-white">{formatNumber(company.profile_count)}</div>
                  <div className="text-xs text-white/38">profiles</div>
                </div>
                <div>
                  <div className="font-semibold text-white">{formatNumber(company.assessment_count)}</div>
                  <div className="text-xs text-white/38">assessments</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function NotesAndLimits({ notes, limits }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.05] p-6">
      <SectionHeading eyebrow="V1 Truth Boundary" title="Missing Data & Limits" />
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <ListBlock title="Missing data notes" items={notes} empty="No missing-data notes returned." />
        <ListBlock title="API limits" items={limits} empty="No limits returned." />
      </div>
    </section>
  )
}

function ProfilesTable({ profiles }) {
  return (
    <TableSection
      eyebrow="Behavior Profiles"
      title="Recent Canonical Dossiers"
      empty="No profile rows were returned by the dashboard API."
    >
      {profiles.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.16em] text-white/38">
                <Th>Profile ID</Th>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Company</Th>
                <Th>Role</Th>
                <Th>Created</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.profile_id} className="text-white/72">
                  <Td mono>{display(profile.profile_id)}</Td>
                  <Td>{displayMissing(profile.name)}</Td>
                  <Td>{displayMissing(profile.email)}</Td>
                  <Td>{displayMissing(profile.phone)}</Td>
                  <Td>{displayMissing(profile.display_company)}</Td>
                  <Td>{displayMissing(profile.role)}</Td>
                  <Td>{formatDate(profile.created_at)}</Td>
                  <Td>{display(profile.completion_status || profile.source)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {profiles.length === 0 && <EmptyState message="No profile rows were returned by the dashboard API." />}
    </TableSection>
  )
}

function AssessmentsTable({ assessments }) {
  return (
    <TableSection
      eyebrow="Business Assessments"
      title="Recent Assessment Activity"
      empty="No Business Assessment rows were returned by the dashboard API."
    >
      {assessments.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.16em] text-white/38">
                <Th>Assessment ID</Th>
                <Th>Owner Profile ID</Th>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Company</Th>
                <Th>Type</Th>
                <Th>Created</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((assessment) => (
                <tr key={assessment.assessment_id} className="text-white/72">
                  <Td mono>{display(assessment.assessment_id)}</Td>
                  <Td mono>{display(assessment.owner_profile_id)}</Td>
                  <Td>{displayMissing(assessment.name)}</Td>
                  <Td>{displayMissing(assessment.email)}</Td>
                  <Td>{displayMissing(assessment.phone)}</Td>
                  <Td>{displayMissing(assessment.display_company)}</Td>
                  <Td>{displayMissing(assessment.assessment_type)}</Td>
                  <Td>{formatDate(assessment.created_at)}</Td>
                  <Td>{display(assessment.status)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {assessments.length === 0 && <EmptyState message="No Business Assessment rows were returned by the dashboard API." />}
    </TableSection>
  )
}

function SectionHeading({ eyebrow, title }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.22em] text-white/42">{eyebrow}</div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{title}</h2>
    </div>
  )
}

function ListBlock({ title, items, empty }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white/80">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-white/45">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-white/60">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="rounded-xl border border-white/8 bg-black/25 px-3 py-2">
              {display(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TableSection({ eyebrow, title, children }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.05] p-6">
      <SectionHeading eyebrow={eyebrow} title={title} />
      <div className="mt-6">{children}</div>
    </section>
  )
}

function Th({ children }) {
  return <th className="border-b border-white/10 px-4 py-3 font-medium">{children}</th>
}

function Td({ children, mono = false }) {
  return (
    <td className={`border-b border-white/8 px-4 py-4 align-top ${mono ? 'font-mono text-xs text-white/64' : ''}`}>
      {children}
    </td>
  )
}

function EmptyState({ message }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-5 text-sm text-white/52">
      {message}
    </div>
  )
}

function StatePanel({ title, body, tone = 'default' }) {
  const toneClass = tone === 'error' ? 'border-red-400/25 bg-red-500/10 text-red-50' : 'border-white/10 bg-white/[0.055] text-white'
  return (
    <div className={`rounded-2xl border p-6 ${toneClass}`}>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-3 text-sm leading-6 opacity-75">{body}</p>
    </div>
  )
}

function DashboardLocked({ message }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 text-white">
      <DashboardBackground />
      <div className="relative z-10 max-w-xl rounded-2xl border border-white/12 bg-white/[0.055] p-8 text-center shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/10 text-emerald-100">
          V1
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          Leadership Dashboard Locked
        </h1>
        <p className="mt-4 text-white/62">{message}</p>
        <Link
          to="/leadership"
          className="mt-7 inline-flex rounded-2xl bg-white px-6 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-black transition hover:bg-emerald-100"
        >
          Go to Access Screen
        </Link>
      </div>
    </div>
  )
}

function DashboardBackground() {
  return (
    <div className="pointer-events-none fixed inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(16,185,129,0.14),transparent_28%),radial-gradient(circle_at_82%_28%,rgba(249,115,22,0.12),transparent_28%),radial-gradient(circle_at_60%_88%,rgba(14,165,233,0.1),transparent_30%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:80px_80px] opacity-30" />
    </div>
  )
}
