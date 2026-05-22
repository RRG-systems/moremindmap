import { useState } from "react"

const departments = [
  "Sales",
  "Operations",
  "Leadership",
  "Recruiting",
  "Marketing",
  "Finance",
  "Customer Service",
  "Administrative",
  "Technology",
  "Product",
]

const industries = [
  "Real Estate",
  "Mortgage / Lending",
  "Recruiting / Staffing",
  "Finance",
  "Insurance",
  "Technology",
  "Healthcare",
  "Education",
  "Retail",
  "Hospitality",
  "Construction",
  "Manufacturing",
  "Consulting",
  "Legal",
]

const reportsToExamples = ["Manager", "Director", "Founder", "CEO", "VP", "President"]

const orgContextOptions = [
  "Individual Contributor",
  "Sales / Production",
  "Team Lead / Manager",
  "Department Leader",
  "Executive / C-Suite",
  "Founder / Owner",
  "Operations / Process",
  "Recruiting / Hiring",
  "Client / Customer Facing",
  "Strategic / Visionary",
  "Administrative / Support",
]

const directReportsOptions = [
  "None",
  "1–3",
  "4–7",
  "8–15",
  "16–30",
  "31–75",
  "76+",
]

const yearsOptions = [
  "Less than 1 year",
  "1–2 years",
  "3–5 years",
  "6–10 years",
  "10+ years",
]

const yearsIndustryOptions = [
  "Less than 1 year",
  "1–3 years",
  "4–7 years",
  "8–15 years",
  "15+ years",
]

export default function Page0A_OrganizationalContext({ onComplete }) {
  const [formData, setFormData] = useState({
    // Identity
    full_name: "",
    email: "",
    phone: "",
    // Organization
    company: "",
    department: "",
    department_other: "",
    role_title: "",
    reports_to: "",
    direct_reports_count: "",
    years_in_current_role: "",
    years_in_industry: "",
    industry: "",
    industry_other: "",
    // Org context (multi-select)
    org_context: [],
  })

  const [errors, setErrors] = useState({})

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    // Clear error when user corrects field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }))
    }
  }

  const handleMultiSelect = (field, value) => {
    setFormData(prev => {
      const current = prev[field] || []
      if (current.includes(value)) {
        return {
          ...prev,
          [field]: current.filter(v => v !== value)
        }
      } else {
        return {
          ...prev,
          [field]: [...current, value]
        }
      }
    })
  }

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.full_name?.trim()) newErrors.full_name = "Required"
    if (!formData.email?.trim()) newErrors.email = "Required"
    if (!formData.company?.trim()) newErrors.company = "Required"
    if (!formData.role_title?.trim()) newErrors.role_title = "Required"
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleContinue = () => {
    if (validateForm()) {
      // Construct metadata object
      const metadata = {
        identity: {
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
        },
        organization: {
          company: formData.company,
          department: formData.department,
          department_other: formData.department_other,
          role_title: formData.role_title,
          reports_to: formData.reports_to,
          direct_reports_count: formData.direct_reports_count,
          years_in_current_role: formData.years_in_current_role,
          years_in_industry: formData.years_in_industry,
          industry: formData.industry,
          industry_other: formData.industry_other,
          org_context: formData.org_context,
        }
      }
      
      onComplete(metadata)
    }
  }

  const isValid = formData.full_name?.trim() && formData.email?.trim() && 
                  formData.company?.trim() && formData.role_title?.trim()

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black text-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/60 backdrop-blur mb-6">
            Page 0A: Organizational Context
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-6">
            Before we begin.
          </h1>
          <div className="prose prose-invert max-w-none space-y-4 text-base text-white/72 leading-8">
            <p>
              Please answer all written responses in your normal voice. There are no right or wrong answers, and you do not need to sound polished, impressive, strategic, or professional.
            </p>
            <p>
              The more honest, specific, and detailed your responses are, the more accurately the system can understand how you actually think, communicate, operate, make decisions, respond under pressure, lead others, and navigate work and life environments.
            </p>
            <p>
              Short or overly generic answers reduce the depth and accuracy of the analysis.
            </p>
            <p>
              This assessment is designed to understand behavioral patterns, operating tendencies, environmental fit, decision structure, leadership dynamics, and organizational friction — not to judge you.
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-8 space-y-8">
          {/* IDENTITY SECTION */}
          <div>
            <h2 className="text-xl font-semibold mb-6 text-white/90">Identity</h2>
            <div className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => handleInputChange("full_name", e.target.value)}
                  className={`w-full px-4 py-3 rounded-lg bg-white/5 border transition focus:outline-none focus:ring-2 ${
                    errors.full_name
                      ? "border-red-500/50 focus:ring-red-500"
                      : "border-white/10 focus:ring-white/20"
                  } text-white placeholder-white/30`}
                  placeholder="Your full name"
                />
                {errors.full_name && <p className="text-red-400 text-xs mt-1">{errors.full_name}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className={`w-full px-4 py-3 rounded-lg bg-white/5 border transition focus:outline-none focus:ring-2 ${
                    errors.email
                      ? "border-red-500/50 focus:ring-red-500"
                      : "border-white/10 focus:ring-white/20"
                  } text-white placeholder-white/30`}
                  placeholder="your@email.com"
                />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/20 transition focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder-white/30"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </div>

          {/* ORGANIZATIONAL SECTION */}
          <div className="border-t border-white/10 pt-8">
            <h2 className="text-xl font-semibold mb-6 text-white/90">Organizational Context</h2>
            <div className="space-y-4">
              {/* Company */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Company <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => handleInputChange("company", e.target.value)}
                  className={`w-full px-4 py-3 rounded-lg bg-white/5 border transition focus:outline-none focus:ring-2 ${
                    errors.company
                      ? "border-red-500/50 focus:ring-red-500"
                      : "border-white/10 focus:ring-white/20"
                  } text-white placeholder-white/30`}
                  placeholder="Company name"
                />
                {errors.company && <p className="text-red-400 text-xs mt-1">{errors.company}</p>}
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Department
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => handleInputChange("department", e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/20 transition focus:outline-none focus:ring-2 focus:ring-white/20 text-white"
                >
                  <option value="">Select department...</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                  <option value="Other">Other</option>
                </select>
                {formData.department === "Other" && (
                  <input
                    type="text"
                    value={formData.department_other}
                    onChange={(e) => handleInputChange("department_other", e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/20 transition focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder-white/30 mt-2"
                    placeholder="Specify department"
                  />
                )}
              </div>

              {/* Role Title */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Role Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.role_title}
                  onChange={(e) => handleInputChange("role_title", e.target.value)}
                  className={`w-full px-4 py-3 rounded-lg bg-white/5 border transition focus:outline-none focus:ring-2 ${
                    errors.role_title
                      ? "border-red-500/50 focus:ring-red-500"
                      : "border-white/10 focus:ring-white/20"
                  } text-white placeholder-white/30`}
                  placeholder="e.g., VP of Sales, Team Leader, COO"
                />
                {errors.role_title && <p className="text-red-400 text-xs mt-1">{errors.role_title}</p>}
              </div>

              {/* Reports To */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Reports To
                </label>
                <input
                  type="text"
                  value={formData.reports_to}
                  onChange={(e) => handleInputChange("reports_to", e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/20 transition focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder-white/30"
                  placeholder="e.g., CEO, Founder, Director"
                  list="reportsToList"
                />
                <datalist id="reportsToList">
                  {reportsToExamples.map(title => (
                    <option key={title} value={title} />
                  ))}
                </datalist>
              </div>

              {/* Direct Reports Count */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Direct Reports
                </label>
                <select
                  value={formData.direct_reports_count}
                  onChange={(e) => handleInputChange("direct_reports_count", e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/20 transition focus:outline-none focus:ring-2 focus:ring-white/20 text-white"
                >
                  <option value="">Select...</option>
                  {directReportsOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Years in Current Role */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Years in Current Role
                </label>
                <select
                  value={formData.years_in_current_role}
                  onChange={(e) => handleInputChange("years_in_current_role", e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/20 transition focus:outline-none focus:ring-2 focus:ring-white/20 text-white"
                >
                  <option value="">Select...</option>
                  {yearsOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Years in Industry */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Years in Industry
                </label>
                <select
                  value={formData.years_in_industry}
                  onChange={(e) => handleInputChange("years_in_industry", e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/20 transition focus:outline-none focus:ring-2 focus:ring-white/20 text-white"
                >
                  <option value="">Select...</option>
                  {yearsIndustryOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Industry */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Industry
                </label>
                <select
                  value={formData.industry}
                  onChange={(e) => handleInputChange("industry", e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/20 transition focus:outline-none focus:ring-2 focus:ring-white/20 text-white"
                >
                  <option value="">Select industry...</option>
                  {industries.map(ind => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                  <option value="Other">Other</option>
                </select>
                {formData.industry === "Other" && (
                  <input
                    type="text"
                    value={formData.industry_other}
                    onChange={(e) => handleInputChange("industry_other", e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-white/20 transition focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder-white/30 mt-2"
                    placeholder="Specify industry"
                  />
                )}
              </div>
            </div>
          </div>

          {/* ORG CONTEXT SECTION */}
          <div className="border-t border-white/10 pt-8">
            <h2 className="text-xl font-semibold mb-6 text-white/90">Organizational Role Context</h2>
            <p className="text-sm text-white/60 mb-4">Select all that apply:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {orgContextOptions.map(option => (
                <button
                  key={option}
                  onClick={() => handleMultiSelect("org_context", option)}
                  className={`px-4 py-3 rounded-lg border text-left transition text-sm font-medium ${
                    formData.org_context.includes(option)
                      ? "border-white/40 bg-white/15 text-white"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/[0.08]"
                  }`}
                >
                  <span className="mr-2">{formData.org_context.includes(option) ? "✓" : " "}</span>
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Continue Button */}
          <div className="border-t border-white/10 pt-8">
            <button
              onClick={handleContinue}
              disabled={!isValid}
              className={`w-full py-4 px-6 rounded-2xl font-semibold text-lg transition ${
                isValid
                  ? "bg-white text-black hover:bg-white/90 shadow-[0_0_40px_rgba(255,255,255,0.15)]"
                  : "bg-white/20 text-white/50 cursor-not-allowed"
              }`}
            >
              Continue to Assessment
            </button>
            <p className="text-xs text-white/40 text-center mt-3">
              * Required fields
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
