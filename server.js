import "dotenv/config"
import express from "express"
import Stripe from "stripe"
import cors from "cors"
import { writeFile, mkdir } from "fs/promises"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { scoreAssessment } from "./engine/scoreAssessment.js"
import { generateMiniProfile } from "./engine/miniProfileGenerator.js"
import OpenAI from "openai"

// Mini V2 pipeline imports
import { buildProfileInput } from "./engine/buildProfileInput.js"
import { generateReportContent } from "./engine/generateReportContent.js"
import { validateReportContent } from "./engine/validateReportContent.js"
import { injectReportContent } from "./engine/injectReportContent.js"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const __dirname = dirname(fileURLToPath(import.meta.url))
const SUBMISSIONS_DIR = join(__dirname, "submissions")

// Ensure submissions directory exists
await mkdir(SUBMISSIONS_DIR, { recursive: true })

const app = express()
app.use(cors())
app.use(express.json())

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const SITE_URL = process.env.SITE_URL || "http://localhost:5173"

// Save submission to JSON file
async function saveSubmission(type, data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const safeName = (data.name || "unknown").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30)
  const filename = `${type}_${safeName}_${timestamp}.json`
  const filepath = join(SUBMISSIONS_DIR, filename)

  const record = {
    type,
    submittedAt: new Date().toISOString(),
    ...data,
  }

  await writeFile(filepath, JSON.stringify(record, null, 2))
  console.log(`[${type.toUpperCase()}] Saved: ${filename}`)
  console.log(`  Name: ${data.name || "N/A"}`)
  console.log(`  Email: ${data.email || "N/A"}`)
  console.log(`  Answers: ${data.answers?.length || 0} questions`)

  return { filename, submittedAt: record.submittedAt }
}

// Profile submission
app.post("/submit/profile", async (req, res) => {
  try {
    const { name, email, answers, questions } = req.body

    if (!answers || !answers.length) {
      return res.status(400).json({ error: "No answers provided" })
    }

    const result = await saveSubmission("profile", { name, email, answers, questions })
    res.json({ success: true, ...result })
  } catch (error) {
    console.error("[PROFILE] Submission error:", error)
    res.status(500).json({ error: error.message })
  }
})

// Real Estate assessment submission
app.post("/submit/real-estate", async (req, res) => {
  try {
    const { name, email, phone, promoCode, answers, questions } = req.body

    if (!answers || !answers.length) {
      return res.status(400).json({ error: "No answers provided" })
    }

    const result = await saveSubmission("real-estate", { name, email, phone, promoCode, answers, questions })
    res.json({ success: true, ...result })
  } catch (error) {
    console.error("[REAL-ESTATE] Submission error:", error)
    res.status(500).json({ error: error.message })
  }
})

// MindMap profile interpretation
app.post("/api/interpret", async (req, res) => {
  try {
    const { name, email, setId, responses, selectedOffer, promoCode, paymentBypassed } = req.body

    if (!setId || !responses || !responses.length) {
      return res.status(400).json({ ok: false, error: "Missing setId or responses" })
    }

    const scoring = scoreAssessment(setId, responses)

    // Save submission
    await saveSubmission("mindmap-profile", {
      name,
      email,
      setId,
      responses,
      scoring,
      selectedOffer,
      ...(paymentBypassed && {
        promoCode,
        paymentBypassed: true,
      }),
    })

    if (scoring.invalid) {
      console.log(`[INTERPRET] Invalid result for ${name || "unknown"} — flat/low signal`)
      return res.json({
        ok: false,
        invalid: true,
        message: "More signal is needed before the profile can be finalized.",
        diagnostics: scoring.diagnostics,
      })
    }

    const primary = scoring.primary[0]
    const secondary = scoring.primary[1]

    const aiPayload = {
      responses,
      normalizedScores: scoring.normalizedScores,
      primary: scoring.primary,
      secondary: scoring.secondary,
      writtenResponses: scoring.writtenResponses,
      diagnostics: scoring.diagnostics,
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You are the interpretation engine for MORE MindMap, a behavioral profiling system. You receive scored assessment data and produce a sharp, specific personality interpretation.

Rules:
- Analyze HOW the person answers, not just WHAT they answer. Pattern of choices matters more than individual answers.
- Avoid generic personality test language. No "You are a natural leader" or "You value connection." Be specific about what their pattern actually looks like in practice.
- Sound specific, sharp, calm, and useful. Write like a strategist briefing someone on themselves.
- Describe how they move through the world — decisions, relationships, pressure, leadership, blind spots.
- Include leadership tendencies and how they behave under pressure.
- Do not overclaim certainty. Use language like "likely," "tends to," "pattern suggests" where appropriate.

Respond with valid JSON only. No markdown. No code fences. Structure:
{
  "headline": "A short 5-10 word profile headline",
  "summary": "2-3 paragraphs describing who this person appears to be, how they operate, and what drives them",
  "primaryPattern": { "key": "${primary.key}", "label": "${primary.label}", "percent": ${primary.percent}, "description": "1-2 sentences on what this pattern looks like in practice" },
  "secondaryPattern": { "key": "${secondary.key}", "label": "${secondary.label}", "percent": ${secondary.percent}, "description": "1-2 sentences on what this pattern looks like in practice" },
  "leadershipNote": "1-2 sentences on how they likely lead or influence others",
  "pressureNote": "1-2 sentences on how they likely behave under pressure or uncertainty"
}`
        },
        {
          role: "user",
          content: JSON.stringify(aiPayload),
        },
      ],
    })

    const raw = completion.choices[0].message.content.trim()
    let interpretation
    try {
      interpretation = JSON.parse(raw)
    } catch {
      console.error("[INTERPRET] Failed to parse OpenAI response:", raw)
      interpretation = {
        headline: `${primary.label} with ${secondary.label} undertone`,
        summary: raw,
        primaryPattern: { key: primary.key, label: primary.label, percent: primary.percent, description: "" },
        secondaryPattern: { key: secondary.key, label: secondary.label, percent: secondary.percent, description: "" },
        leadershipNote: "",
        pressureNote: "",
      }
    }

    console.log(`[INTERPRET] Profile generated for ${name || "unknown"}: ${interpretation.headline}`)

    res.json({
      ok: true,
      scoring: {
        setId: scoring.setId,
        normalizedScores: scoring.normalizedScores,
        ranked: scoring.ranked,
        primary: scoring.primary,
        secondary: scoring.secondary,
        diagnostics: scoring.diagnostics,
      },
      interpretation,
    })
  } catch (error) {
    console.error("[INTERPRET] Error:", error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// Price ID mapping for offers
const PRICE_IDS = {
  mini_profile: "price_1TJIWaQfYs6pD2VYMix5k25O",
  mini_review: "price_1TJIYBQfYs6pD2VYifbDIE2e",
  full_profile: "price_1THSa7QfYs6pD2VYx3KDGx1E",
  full_review: "price_1TJIYgQfYs6pD2VYDnVA2at2",
  full_coaching: "price_1THSa7QfYs6pD2VYx3KDGx1E", // Use full_profile price for coaching
}

app.post("/create-checkout-session", async (req, res) => {
  try {
    const { selectedOffer } = req.body

    if (!selectedOffer || !PRICE_IDS[selectedOffer]) {
      return res.status(400).json({ error: "Invalid or missing selectedOffer" })
    }

    const priceId = PRICE_IDS[selectedOffer]
    const metadata = {
      selectedOffer,
      ...(selectedOffer === "full_coaching" && {
        calendlyRequired: "true",
      }),
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata,
      success_url: `${SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/`,
    })

    res.json({ url: session.url, sessionId: session.id })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// DEBUG: Log all incoming requests
app.use((req, res, next) => {
  console.log("INCOMING:", req.method, req.url);
  next();
});

// Mini Profile endpoint (PHASE 1: Dominance model + tradeoffs + long-form)
app.post("/api/moremindmap/mini-profile", async (req, res) => {
  try {
    const { answers } = req.body

    if (!answers || typeof answers !== "object") {
      return res.status(400).json({ success: false, error: "Missing or invalid answers" })
    }

    // Validate we have answers for all 24 questions
    const answerCount = Object.keys(answers).length
    if (answerCount < 24) {
      return res.status(400).json({ 
        success: false, 
        error: `Expected 24 answers, got ${answerCount}` 
      })
    }

    // Convert frontend answer format to scoring engine format
    // Frontend sends: { q1: "A", q2: "B", ... }
    // Scoring engine expects: [{ questionId: 1, type: "multiple_choice", answer: "A" }, ...]
    const responses = Object.entries(answers).map(([questionId, answer]) => ({
      questionId: parseInt(questionId),
      type: "multiple_choice", // TODO: handle multi_select and written types
      answer
    }))

    // Score the assessment
    const scoringPayload = scoreAssessment("set_1", responses)

    // Check for diagnostic flags
    if (scoringPayload.invalid) {
      return res.status(400).json({
        success: false,
        error: "Assessment results unclear. Additional clarification needed.",
        nextStep: scoringPayload.nextStep,
        diagnostics: scoringPayload.diagnostics
      })
    }

    // Extract written responses for Phase 2A interpretation
    const writtenResponses = Object.entries(answers)
      .filter(([qId, answer]) => typeof answer === 'string' && answer.length > 10)
      .map(([qId, answer]) => answer)

    // Generate mini profile with dominance model, tradeoffs, long-form content, AND Phase 2A written response interpretation
    const miniProfile = generateMiniProfile(scoringPayload, writtenResponses)

    // Save submission
    await saveSubmission("moremindmap-mini-profile", {
      answers,
      scoringPayload,
      miniProfile,
    })

    // Log the actual response being sent
    console.log("[MOREMINDMAP] LIVE MINI PROFILE RESPONSE:")
    console.log("─".repeat(80))
    console.log(JSON.stringify(miniProfile, null, 2))
    console.log("─".repeat(80))
    console.log("[MOREMINDMAP] Has what_this_means?", !!miniProfile.what_this_means)
    console.log("[MOREMINDMAP] Has dominance_note?", !!miniProfile.dominance_note)
    console.log("[MOREMINDMAP] Has dominance_structure?", !!miniProfile.dominance_structure)
    console.log("[MOREMINDMAP] Has written_interpretation?", !!miniProfile.written_interpretation)
    console.log("[MOREMINDMAP] Has interpreter_modifier?", !!miniProfile.interpreter_modifier)
    if (miniProfile.written_interpretation) {
      console.log("[MOREMINDMAP] Written Interpretation:", JSON.stringify(miniProfile.written_interpretation, null, 2))
    }
    if (miniProfile.interpreter_modifier) {
      console.log("[MOREMINDMAP] Interpreter Modifier:", JSON.stringify(miniProfile.interpreter_modifier, null, 2))
    }

    // Return success with both payloads
    res.json({
      success: true,
      scoringPayload: {
        dimensions: scoringPayload.normalizedScores,
        ranked_dimensions: scoringPayload.ranked,
        primary_patterns: scoringPayload.primary.map(d => d.label),
        secondary_patterns: scoringPayload.secondary.map(d => d.label),
        diagnostics: scoringPayload.diagnostics,
        metadata: {
          totalQuestionsAnswered: answerCount,
          timestamp: new Date().toISOString(),
        },
      },
      miniProfile,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[MOREMINDMAP] Submission error:", error)
    res.status(500).json({
      success: false,
      error: error.message || "Assessment processing failed",
    })
  }
})

// Mini Profile V2 endpoint (CONTROLLED BETA: 10-page HTML report)
app.post("/api/moremindmap/mini-profile-v2", async (req, res) => {
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

    // Save submission
    await saveSubmission("moremindmap-mini-profile-v2", {
      answers,
      profileInput,
      reportContent,
      qualityReport,
      snapshot,
    })

    console.log("[MINI-V2] SUCCESS!")
    console.log(`[MINI-V2] HTML size: ${html.length} chars`)
    console.log(`[MINI-V2] Pages rendered: ${snapshot.pages_rendered}`)
    console.log(`[MINI-V2] Placeholders remaining: ${snapshot.placeholder_count}`)
    console.log(`[MINI-V2] Quality score: ${qualityReport.overall_quality_score}/100`)

    // Return success with HTML report
    res.json({
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
})

// Narrative V3: Server-side GPT-5.5 integration
// Keeps API key secure by processing on server, not exposing to browser
app.post("/api/moremindmap/narrative-v3", async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;

  // Validate API key exists
  if (!apiKey) {
    console.warn('[NARRATIVE-V3] OPENAI_API_KEY not set in environment');
    return res.status(500).json({ 
      error: 'API key not configured',
      API_KEY_PRESENT: false,
      render_source: 'fallback_local'
    });
  }

  try {
    const { prompt, section } = req.body;

    if (!prompt || !section) {
      return res.status(400).json({ error: 'Missing prompt or section' });
    }

    console.log(`[NARRATIVE-V3 CALL START] Section: ${section}`);

    const systemMessage = prompt.systemRule || '';
    const userMessage = buildNarrativeUserMessage(prompt);

    const requestBody = {
      model: 'gpt-4o-2024-08-06',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 1200,
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`[NARRATIVE-V3 ERROR] HTTP ${response.status}:`, error);
      return res.status(response.status).json({ 
        error: 'OpenAI API error',
        details: error
      });
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      console.warn(`[NARRATIVE-V3] Empty response`);
      return res.status(500).json({ error: 'Empty response from OpenAI' });
    }

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.warn(`[NARRATIVE-V3 JSON PARSE ERROR]:`, e);
      return res.status(500).json({ error: 'Failed to parse OpenAI response' });
    }

    // Validate structure
    if (!parsed.section || !parsed.body) {
      console.warn(`[NARRATIVE-V3] Missing required fields`);
      return res.status(500).json({ error: 'Invalid response structure' });
    }

    console.log(`[NARRATIVE-V3 CALL SUCCESS] Section: ${section}, Body length: ${parsed.body.length}`);

    // Add metadata
    parsed.fromGPT = true;
    parsed.generatedAt = new Date().toISOString();
    parsed.API_KEY_PRESENT = true;
    parsed.render_source = 'gpt55';
    parsed.SIGNAL_VERIFIED_55 = 'live-endpoint-verified';

    return res.status(200).json(parsed);
  } catch (err) {
    console.error(`[NARRATIVE-V3 EXCEPTION]:`, err);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: err.message 
    });
  }
});

// Helper: Build user message for Narrative V3 GPT call
function buildNarrativeUserMessage(prompt) {
  const parts = [];

  // CRITICAL: response_format json_object requires 'json' in the user message
  parts.push('Respond with valid JSON.');

  if (prompt.instruction) {
    parts.push(`INSTRUCTION:\n${prompt.instruction}`);
  }

  if (prompt.canonical) {
    parts.push(`\nCANONICAL EVIDENCE:\n${JSON.stringify(prompt.canonical, null, 2)}`);
  }

  if (prompt.format) {
    parts.push(`\nRESPONSE FORMAT:\n${prompt.format}`);
  }

  return parts.join('\n\n');
}

app.listen(4242, () => console.log("Server running on port 4242"))
