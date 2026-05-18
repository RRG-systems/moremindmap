import { buildProfileInput } from "../engine/buildProfileInput.js"
import { generateReportContent } from "../engine/generateReportContent.js"
import { validateReportContent } from "../engine/validateReportContent.js"
import { injectReportContent } from "../engine/injectReportContent.js"

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

    console.log("[MINI-V2] Starting Mini V2 pipeline...")
    console.log(`[MINI-V2] Received ${answerCount} answers`)

    // STEP 1: Build profile input (convert answers to forensic intelligence)
    console.log("[MINI-V2] Step 1: buildProfileInput...")
    const profileInput = await buildProfileInput(answers)
    
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
    const { html, snapshot } = await injectReportContent(reportContent)
    
    if (!html) {
      return res.status(500).json({
        success: false,
        error: "Failed to generate HTML report",
        version: "mini-v2"
      })
    }

    console.log("[MINI-V2] SUCCESS!")
    console.log(`[MINI-V2] HTML size: ${html.length} chars`)
    console.log(`[MINI-V2] Pages rendered: ${snapshot.pages_rendered}`)
    console.log(`[MINI-V2] Placeholders remaining: ${snapshot.placeholder_count}`)
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
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    })
  }
}
