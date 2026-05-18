// Diagnostic endpoint to expose repair pass internals

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const { answers } = req.body
    
    if (!answers) {
      return res.status(200).json({
        ok: true,
        route: "diagnostic-repair",
        timestamp: new Date().toISOString(),
        message: "Minimal diagnostic endpoint working - no answers provided"
      })
    }
    
    // Import and test buildProfileInput
    const { buildProfileInput } = await import("./engine/buildProfileInput.js")
    
    // Convert answer format
    const formattedAnswers = {}
    Object.keys(answers).forEach(key => {
      const qKey = key.startsWith('q') ? key : `q${key}`
      const value = answers[key]
      if (typeof value === 'string' && value.length === 1 && /[A-E]/i.test(value)) {
        formattedAnswers[qKey] = { choice: value.toUpperCase() }
      } else {
        formattedAnswers[qKey] = { text: '[MASKED]' }  // Mask user content
      }
    })
    
    const profileInput = await buildProfileInput({ answers: formattedAnswers })
    
    // Import and test full pipeline
    const { default: generateReportContent } = await import("./engine/generateReportContent.js")
    const { default: injectReportContent } = await import("./engine/injectReportContent.js")
    
    const reportContent = await generateReportContent(profileInput)
    const firstPass = await injectReportContent(reportContent)
    
    res.status(200).json({
      ok: true,
      step: "full_pipeline",
      first_pass: {
        placeholder_count: firstPass.snapshot.placeholder_count,
        placeholders_sample: (firstPass.snapshot.placeholders || []).slice(0, 30),
        report_top_keys: Object.keys(reportContent),
        page03_keys: Object.keys(reportContent.page03_executive_summary || {}),
        page04_keys: Object.keys(reportContent.page04_operating_pattern || {})
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    })
  }
}
