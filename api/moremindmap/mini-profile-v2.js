// Imports moved to dynamic imports inside handler for better error capture

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Credentials", true)
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  if (req.method !== "POST") {
    return res.status(405).json({ 
      success: false, 
      error: "Method not allowed" 
    })
  }

  try {
    // Dynamic imports to catch import errors
    const { buildProfileInput } = await import("../engine/buildProfileInput.js")
    const { default: generateReportContent } = await import("../engine/generateReportContent.js")
    const { default: validateReportContent } = await import("../engine/validateReportContent.js")
    const { default: injectReportContent } = await import("../engine/injectReportContent.js")

    const { answers } = req.body

    if (!answers || typeof answers !== "object") {
      return res.status(400).json({ 
        success: false, 
        error: "Missing or invalid answers",
        version: "mini-v2"
      })
    }

    // Validate we have answers for all 24 questions
    const answerCount = Object.keys(answers).length
    if (answerCount < 24) {
      return res.status(400).json({ 
        success: false, 
        error: `Expected 24 answers, got ${answerCount}`,
        version: "mini-v2"
      })
    }

    // Convert numeric keys to q-prefixed keys and normalize format for backend compatibility
    // Backend expects: { qN: { choice: 'A' } } or { qN: { text: 'written response' } }
    // Frontend sends: { N: 'A' } or { N: 'written response' }
    const formattedAnswers = {}
    Object.keys(answers).forEach(key => {
      const qKey = key.startsWith('q') ? key : `q${key}`
      const value = answers[key]
      
      // Detect if it's a written response (long text) or multiple choice (single letter)
      if (typeof value === 'string' && value.length === 1 && /[A-E]/i.test(value)) {
        // Multiple choice
        formattedAnswers[qKey] = { choice: value.toUpperCase() }
      } else {
        // Written response
        formattedAnswers[qKey] = { text: value }
      }
    })

    console.log("[MINI-V2] Starting Mini V2 pipeline...")
    console.log(`[MINI-V2] Received ${answerCount} answers`)

    // STEP 1: Build profile input (convert answers to forensic intelligence)
    console.log("[MINI-V2] Step 1: buildProfileInput...")
    const profileInput = await buildProfileInput({ answers: formattedAnswers })
    
    if (!profileInput || profileInput.error) {
      return res.status(400).json({
        success: false,
        error: profileInput?.error || "Failed to build profile input",
        version: "mini-v2"
      })
    }

    // STEP 2: Generate report content (AI interpretation)
    console.log("[MINI-V2] Step 2: generateReportContent...")
    const reportContent = await generateReportContent(profileInput)
    
    if (!reportContent || reportContent.error) {
      return res.status(500).json({
        success: false,
        error: reportContent?.error || "Failed to generate report content",
        version: "mini-v2",
        generation_mode: reportContent?.generation_metadata?.generation_mode || "unknown"
      })
    }

    // STEP 3: Validate report quality
    console.log("[MINI-V2] Step 3: validateReportContent...")
    const qualityReport = await validateReportContent(reportContent)
    
    if (qualityReport.validation_status === "FAIL") {
      console.warn("[MINI-V2] Quality validation failed:", qualityReport)
      // Continue anyway for beta (don't block on quality issues)
    }

    // STEP 4: Inject content into HTML templates
    console.log("[MINI-V2] Step 4: injectReportContent...")
    let { html, snapshot } = await injectReportContent(reportContent)
    
    if (!html) {
      return res.status(500).json({
        success: false,
        error: "Failed to generate HTML report",
        version: "mini-v2"
      })
    }
    
    // STEP 4.5: Missing Field Repair Pass (if placeholders remain)
    if (snapshot.placeholder_count > 0 && snapshot.placeholders) {
      console.log(`[MINI-V2] Step 4.5: Repair pass for ${snapshot.placeholder_count} missing fields...`)
      console.log(`[MINI-V2] Missing fields:`, snapshot.placeholders.slice(0, 10))
      
      try {
        // Make targeted repair call
        const repairedFields = await generateReportContent(profileInput, snapshot.placeholders)
        
        // Deep merge repaired fields into existing content
        Object.keys(repairedFields).forEach(pageKey => {
          if (reportContent[pageKey] && typeof repairedFields[pageKey] === 'object') {
            reportContent[pageKey] = { ...reportContent[pageKey], ...repairedFields[pageKey] }
          }
        })
        
        // Re-inject with repaired content
        console.log("[MINI-V2] Re-injecting with repaired fields...")
        const repairResult = await injectReportContent(reportContent)
        html = repairResult.html
        snapshot = repairResult.snapshot
        
        console.log(`[MINI-V2] After repair: ${snapshot.placeholder_count} placeholders remaining`)
      } catch (repairError) {
        console.error("[MINI-V2] Repair pass failed:", repairError.message)
        // Continue with first-pass output rather than failing completely
      }
    }

    // Final placeholder check after repair attempt
    if (snapshot.placeholder_count > 0) {
      console.warn(`[MINI-V2] INCOMPLETE: ${snapshot.placeholder_count} placeholders remain after repair`)
      return res.status(500).json({
        success: false,
        error: `Report incomplete: ${snapshot.placeholder_count} placeholders remain`,
        version: "mini-v2",
        placeholders: snapshot.placeholders?.slice(0, 50),
        repair_attempted: snapshot.placeholder_count < 88
      })
    }

    console.log("[MINI-V2] SUCCESS!")
    console.log(`[MINI-V2] HTML size: ${html.length} chars`)
    console.log(`[MINI-V2] Pages rendered: ${snapshot.pages_rendered}`)
    console.log(`[MINI-V2] Quality score: ${qualityReport.overall_quality_score}/100`)

    // Return success with HTML report
    res.status(200).json({
      success: true,
      version: "mini-v2",
      reportType: "html",
      html,
      qualityReport: {
        score: qualityReport.overall_quality_score,
        validation_status: qualityReport.validation_status,
        genericity_score: qualityReport.genericity_score,
      },
      snapshot: {
        pages_rendered: snapshot.pages_rendered,
        placeholder_count: snapshot.placeholder_count,
        coverage_percent: snapshot.coverage_percent,
      },
      generation_mode: reportContent.generation_metadata?.generation_mode || "unknown",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[MINI-V2] Pipeline error:", error)
    res.status(500).json({
      success: false,
      version: "mini-v2",
      error: error.message || "Mini V2 pipeline failed",
      stack: error.stack,
      errorName: error.name,
      errorCause: error.cause
    })
  }
}
