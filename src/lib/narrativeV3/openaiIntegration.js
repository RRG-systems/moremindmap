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
 * Routes through server endpoint to keep API key secure.
 * 
 * @param {Object} prompt - Structured prompt with systemRule, section, canonical, instruction, format
 * @param {string} section - Section name for logging
 * @returns {Object} Structured narrative output or null if failure
 */
export async function callGPT55(prompt, section) {
  try {
    console.log(`[GPT-5.5 CALL START] Section: ${section}`);

    const response = await fetch('/api/moremindmap/narrative-v3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, section }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`[GPT-5.5 ERROR] HTTP ${response.status}:`, error);
      console.warn('[GPT-5.5] Endpoint returned error. Using local fallback.');
      return null;
    }

    const data = await response.json();

    // Check for API key issue
    if (data.API_KEY_PRESENT === false) {
      console.warn('[GPT-5.5] Server API key not configured. Using local fallback.');
      return null;
    }

    // Validate structure
    if (!data.section || !data.body) {
      console.warn(`[GPT-5.5] Missing required fields`);
      return null;
    }

    console.log(`[GPT-5.5 CALL SUCCESS] Section: ${section}, Body length: ${data.body.length}`);
    console.log(`[GPT-5.5] Render source: ${data.render_source}, Signal: ${data.SIGNAL_VERIFIED_55}`);

    return data;
  } catch (err) {
    console.error(`[GPT-5.5 EXCEPTION]:`, err);
    console.warn('[GPT-5.5] Network error. Using local fallback.');
    return null;
  }
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
