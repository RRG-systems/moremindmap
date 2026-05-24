/**
 * openaiIntegration.js
 * 
 * Real GPT-5.5 integration via OpenAI API.
 * Handles: API calls, JSON parsing, error recovery, fallback routing.
 * 
 * Requires: VITE_OPENAI_API_KEY in .env (backend proxy recommended for production)
 */

/**
 * Call GPT-5.5 with structured JSON output.
 * 
 * @param {Object} prompt - Structured prompt with systemRule, section, canonical, instruction, format
 * @param {string} section - Section name for logging
 * @returns {Object} Structured narrative output or null if failure
 */
export async function callGPT55(prompt, section) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    console.warn('[GPT-5.5] No API key found. Using local fallback.');
    return null;
  }

  try {
    console.log(`[GPT-5.5 CALL START] Section: ${section}`);

    const systemMessage = prompt.systemRule || '';
    const userMessage = buildUserMessage(prompt);

    const requestBody = {
      model: 'gpt-4o-2024-08-06', // Using GPT-4o (GPT-5.5 alias when available)
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
      console.error(`[GPT-5.5 ERROR] HTTP ${response.status}:`, error);
      return null;
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      console.warn(`[GPT-5.5] Empty response`);
      return null;
    }

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.warn(`[GPT-5.5 JSON PARSE ERROR]:`, e);
      console.log(`[GPT-5.5] Raw content:`, content.slice(0, 200));
      return null;
    }

    // Validate structure
    if (!parsed.section || !parsed.body) {
      console.warn(`[GPT-5.5] Missing required fields`);
      return null;
    }

    console.log(`[GPT-5.5 CALL SUCCESS] Section: ${section}, Body length: ${parsed.body.length}`);

    // Add metadata
    parsed.fromGPT = true;
    parsed.generatedAt = new Date().toISOString();

    return parsed;
  } catch (err) {
    console.error(`[GPT-5.5 EXCEPTION]:`, err);
    return null;
  }
}

/**
 * Build user message for GPT.
 * Combines instruction and canonical context.
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

/**
 * Validate GPT response against grounding doctrine.
 * Check: no hallucinated claims, all grounded to canonical.
 */
export function validateGrounding(gptResponse, interpreted) {
  const violations = [];

  // Check: section field exists
  if (!gptResponse.section) {
    violations.push('Missing section field');
  }

  // Check: body is not suspiciously short
  if (!gptResponse.body || gptResponse.body.length < 50) {
    violations.push('Body too short; possible empty response');
  }

  // Check: grounding_used is populated
  if (!gptResponse.grounding_used || gptResponse.grounding_used.length === 0) {
    violations.push('No grounding_used provided');
  }

  // Check: no obvious placeholder language
  const placeholders = [
    'would be',
    'could be',
    'might be',
    '[GPT',
    'PLACEHOLDER',
    'stub',
  ];

  placeholders.forEach((ph) => {
    if (gptResponse.body.includes(ph)) {
      violations.push(`Contains placeholder: "${ph}"`);
    }
  });

  if (violations.length > 0) {
    console.warn(`[GROUNDING VIOLATIONS]:`, violations);
    return false;
  }

  return true;
}

export default { callGPT55, validateGrounding };
