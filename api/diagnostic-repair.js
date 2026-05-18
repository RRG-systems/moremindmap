// Diagnostic endpoint to expose repair pass internals
import { buildProfileInput } from "./engine/buildProfileInput.js"
import { default: generateReportContent } from "./engine/generateReportContent.js"
import { default: injectReportContent } from "./engine/injectReportContent.js"

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const { answers } = req.body
    
    // Convert answer format
    const formattedAnswers = {}
    Object.keys(answers).forEach(key => {
      const qKey = key.startsWith('q') ? key : `q${key}`
      const value = answers[key]
      if (typeof value === 'string' && value.length === 1 && /[A-E]/i.test(value)) {
        formattedAnswers[qKey] = { choice: value.toUpperCase() }
      } else {
        formattedAnswers[qKey] = { text: value }
      }
    })

    // STEP 1: Build profile
    const profileInput = await buildProfileInput({ answers: formattedAnswers })
    
    // STEP 2: First-pass generation
    const reportContent = await generateReportContent(profileInput)
    
    // STEP 3: First injection
    const firstPass = await injectReportContent(reportContent)
    
    const diagnostic = {
      step: "diagnostic",
      first_pass: {
        placeholder_count: firstPass.snapshot.placeholder_count,
        placeholders_sample: (firstPass.snapshot.placeholders || []).slice(0, 30),
        reportContent_top_keys: Object.keys(reportContent),
        page03_keys: reportContent.page03_executive_summary ? Object.keys(reportContent.page03_executive_summary) : [],
        page04_keys: reportContent.page04_operating_pattern ? Object.keys(reportContent.page04_operating_pattern) : []
      }
    }
    
    // STEP 4: If placeholders exist, show what repair would receive
    if (firstPass.snapshot.placeholders && firstPass.snapshot.placeholders.length > 0) {
      diagnostic.repair_input = {
        missing_fields_count: firstPass.snapshot.placeholders.length,
        missing_fields_sample: firstPass.snapshot.placeholders.slice(0, 30),
        profile_input_size: JSON.stringify(profileInput).length
      }
    }
    
    res.status(200).json(diagnostic)
    
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    })
  }
}
