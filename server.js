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

app.listen(4242, () => console.log("Server running on port 4242"))
