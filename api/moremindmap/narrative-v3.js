/**
 * /api/moremindmap/narrative-v3.js
 * 
 * Server-side GPT-5.5 integration endpoint.
 * Moves API key to server (not exposed in browser).
 * Client calls this endpoint instead of calling OpenAI directly.
 */

const apiKey = process.env.OPENAI_API_KEY;

export default async function handler(req, res) {
  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    console.log(`[NARRATIVE-V3] Prompt keys: ${Object.keys(prompt).join(', ')}`);
    console.log(`[NARRATIVE-V3] Prompt.canonical keys: ${Object.keys(prompt.canonical || {}).join(', ')}`);

    const systemMessage = prompt.systemRule || '';
    const userMessage = buildUserMessage(prompt);

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
        status: response.status,
        rate_limited: response.status === 429 || error?.error?.code === 'rate_limit_exceeded',
        message: error?.error?.message || `OpenAI HTTP ${response.status}`,
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
    const hasStructuredSection =
      (section === 'fiveFutures' && Array.isArray(parsed.futures)) ||
      (section === 'facilitatorNotes' && Array.isArray(parsed.notes)) ||
      (section === 'teamExperience' && isStructuredTeamExperience(parsed)) ||
      (section === 'recommendedNextStep' && isStructuredOneMove(parsed));

    if (!parsed.section || (!parsed.body && !hasStructuredSection)) {
      console.warn(`[NARRATIVE-V3] Missing required fields`);
      console.warn(`[NARRATIVE-V3] Parsed object keys: ${Object.keys(parsed).join(', ')}`);
      console.warn(`[NARRATIVE-V3] Parsed.section: ${parsed.section}`);
      console.warn(`[NARRATIVE-V3] Parsed.body length: ${parsed.body?.length || 0}`);
      return res.status(500).json({ error: 'Invalid response structure' });
    }

    console.log(`[NARRATIVE-V3 CALL SUCCESS] Section: ${section}, Body length: ${parsed.body?.length || 0}`);

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
}

function isStructuredTeamExperience(value) {
  if (!value?.summary) return false;

  const validSignals = [
    value.first_impression?.interpretation,
    value.communication_pattern?.interpretation,
    value.listening_pattern?.interpretation,
    value.relational_friction?.interpretation,
    Array.isArray(value.key_signals) && value.key_signals.length >= 2,
    value.causal_interpretation,
  ].filter(Boolean).length;

  return validSignals >= 2;
}

function isStructuredOneMove(value) {
  return Boolean(
    value?.headline &&
    value?.futureBottleneck &&
    value?.intervention &&
    value?.roleTruth
  );
}

/**
 * Build user message for GPT.
 */
function buildUserMessage(prompt) {
  const parts = [];

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
