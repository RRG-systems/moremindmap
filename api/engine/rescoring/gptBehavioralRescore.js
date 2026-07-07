import { getModelForRoute, resolveModelForRoute } from '../config/modelRegistry.js';

/**
 * gptBehavioralRescore.js
 * 
 * GPT-5.5 BEHAVIORAL COGNITION LAYER
 * 
 * Reinterprets the full canonical dossier with behavioral depth.
 * Reads deterministic topology, then applies human-level pattern recognition.
 * 
 * Core principle:
 * The deterministic layer is correct geometry. GPT adds meaning.
 * User feels: "this understood me" (not "this applied math to me").
 * 
 * No fake drama. No cartoon extremity. No LinkedIn mythology.
 * Honest behavioral interpretation grounded in canonical evidence.
 */




/**
 * Call OpenAI GPT-5.5 directly from server (not frontend fetch)
 */
async function callGPT55Serverside(systemRule, instruction) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.error('[GPT-RESCORE] OPENAI_API_KEY not configured');
    return null;
  }

  const routeResolution = resolveModelForRoute('bos.rescoring');
  const selectedModel = routeResolution.model;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          {
            role: 'system',
            content: systemRule
          },
          {
            role: 'user',
            content: instruction
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GPT-RESCORE] OpenAI API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('[GPT-RESCORE] Invalid OpenAI response structure');
      return null;
    }

    return {
      body: data.choices[0].message.content,
      model: selectedModel,
      model_source: routeResolution.model_source,
    };
  } catch (err) {
    console.error('[GPT-RESCORE] OpenAI call failed:', err.message);
    return null;
  }
}


/**
 * Main entry point: Apply GPT behavioral rescoring to canonical profile
 * 
 * @param {Object} canonical - Complete canonical dossier (already has rescoring_v1)
 * @returns {Promise<Object>} rescoring_gpt object with behavioral interpretation
 */
export async function gptBehavioralRescore(canonical) {
  try {
    // Validate preconditions
    if (!canonical) {
      console.error('[GPT-RESCORE] Missing canonical input');
      return null;
    }

    if (!canonical.ranked_dimensions || !canonical.rescoring_v1) {
      console.error('[GPT-RESCORE] Missing baseline or deterministic rescoring');
      return null;
    }

    // Build the GPT prompt with full context
    const prompt = buildGPTRescoringPrompt(canonical);

    // Call GPT-5.5 with structured behavioral prompt
    console.log('[GPT-RESCORE] Calling GPT-5.5 with full canonical context...');
    const gptResponse = await callGPT55Serverside(prompt.systemRule, prompt.instruction);

    if (!gptResponse) {
      console.warn('[GPT-RESCORE] GPT call failed, falling back to deterministic');
      return null;
    }

    // Parse GPT response
    let rescoring_gpt = null;
    
    // Try to extract JSON if response is wrapped in text
    if (gptResponse.body) {
      try {
        rescoring_gpt = JSON.parse(gptResponse.body);
      } catch (parseErr) {
        console.warn('[GPT-RESCORE] Failed to parse GPT response as JSON:', parseErr.message);
        // Try to extract JSON from markdown code block
        const jsonMatch = gptResponse.body.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
          try {
            rescoring_gpt = JSON.parse(jsonMatch[1]);
          } catch (e) {
            console.warn('[GPT-RESCORE] Failed to extract JSON from code block');
            return null;
          }
        }
      }
    } else if (typeof gptResponse === 'object') {
      // Response might already be parsed
      rescoring_gpt = gptResponse;
    }

    if (!rescoring_gpt) {
      console.warn('[GPT-RESCORE] Could not extract rescoring object from GPT');
      return null;
    }

    const selectedModel = gptResponse.model || getModelForRoute('bos.rescoring');
    rescoring_gpt.model = selectedModel;
    if (gptResponse.model_source) {
      rescoring_gpt.model_source = gptResponse.model_source;
    }

    normalizeProfileIntensity(rescoring_gpt);

    // Validate GPT output structure
    const validation = validateGPTRescoreOutput(rescoring_gpt, canonical, selectedModel);
    if (!validation.valid) {
      console.warn('[GPT-RESCORE] Validation failed:', validation.errors);
      return null;
    }

    // Normalize scores to ensure they're comparable
    normalizeGPTScores(rescoring_gpt, canonical);

    // Guard against GPT treating topology scores as capability ratings
    applyCalibrationGuardrails(rescoring_gpt, canonical);

    // Enrich with audit trail
    enrichAuditTrail(rescoring_gpt, canonical);

    console.log('[GPT-RESCORE] ✅ GPT behavioral rescoring complete');
    return rescoring_gpt;

  } catch (err) {
    console.error('[GPT-RESCORE] Unexpected error:', err);
    return null;
  }
}

/**
 * Build structured prompt for GPT behavioral rescoring
 * 
 * Provides full context: baseline, deterministic topology, canonical evidence
 * Asks GPT to reinterpret the person with behavioral depth
 */
function buildGPTRescoringPrompt(canonical) {
  const baseline = canonical.ranked_dimensions || [];
  const rescoring_v1 = canonical.rescoring_v1 || {};
  
  // Extract key behavioral evidence
  const evidence = {
    written_responses: canonical.intake_answers || {},
    contradictions: canonical.contradictions || [],
    stress_patterns: canonical.stress_patterns || {},
    communication_style: canonical.communication_style || {},
    organizational_effects: canonical.organizational_effects || {},
    life_direction: canonical.life_direction || {},
    hidden_costs: canonical.hidden_costs || {},
    inferred_patterns: canonical.inferred_patterns || {}
  };

  // Compile baseline scores for reference
  const baselineForDisplay = baseline.map((d, idx) => ({
    rank: idx + 1,
    dimension: d.dimension,
    score: d.score,
    confidence: d.confidence || 0.8
  }));

  // Compile deterministic topology
  const dominanceProfile = {
    ...(rescoring_v1.dominance_profile || {})
  };
  if (dominanceProfile.profile_intensity) {
    dominanceProfile.profile_intensity = normalizeProfileIntensityValue(dominanceProfile.profile_intensity);
  }

  const deterministic = {
    version: rescoring_v1.version,
    dominance_profile: dominanceProfile,
    spread_profile: rescoring_v1.spread_profile || {},
    profile_shape: rescoring_v1.spread_profile?.profile_shape || null,
    profile_shape_confidence: rescoring_v1.spread_profile?.profile_shape_confidence || null,
    amplitude_metrics: rescoring_v1.amplitude_metrics || {},
    tension_pairs: rescoring_v1.tension_pairs || {},
    suppressions: rescoring_v1.suppressions || []
  };

  const systemRule = `You are a behavioral psychologist interpreting a person's operational profile through comprehensive assessment data.

Your task: Reinterpret the 8 core dimensions with behavioral depth.

INPUT:
- 8 baseline dimensions (empirical scoring from assessment)
- Deterministic topology analysis (mathematical dominance patterns)
- Full canonical dossier (written responses, contradictions, stress patterns, org effects, etc.)

OUTPUT:
Provide a JSON structure that reinterprets the profile with behavioral cognition.

CORE PRINCIPLES:
1. NO FAKE DRAMA: Stay grounded in canonical evidence
2. NO CARTOON EXTREMITY: Psychological believability over theatrical effect
3. DETECT HIDDEN PATTERNS: Masking, compensation, asymmetry, suppression
4. HONOR DETERMINISTIC LAYER: It's correct geometry; add meaning to it
5. GROUND ALL CLAIMS: Every reinterpretation must trace to evidence
6. BEHAVIORAL TRUTH: What this person actually does under pressure

SCORING CALIBRATION:
- Scores are behavioral topology coordinates, NOT talent, competence, leadership quality, intelligence, or capability ratings.
- Default to preserving baseline and deterministic V1 numeric scores unless strong dossier evidence proves the topology is misweighted.
- Numeric changes over 0.3 require explicit evidence in the rationale.
- Numeric changes over 0.75 require multiple independent evidence sources.
- Numeric changes over 1.0 should be rare and must be justified in audit.reason_for_changes or audit.warning_flags.
- Do not raise all or most dimensions. Total upward movement should be near zero unless exceptional evidence is present.
- If one dimension is amplified, another should usually be compressed or preserved.
- Balanced, flat, or distributed profiles must remain balanced/distributed unless full canonical evidence proves hidden concentration.
- Preserve rank order unless full canonical evidence directly contradicts it.
- Do not give suppressed dimensions high positive display scores just because the person has the capability. Scores represent operating weight, not ability.
- If deterministic V1 says profile_intensity is "medium", output "moderate". Never output "medium".

DIMENSION INTERPRETATION GUIDE:
- Vector: Decision velocity, directional clarity, agency in ambiguity
- Horizon: Time horizon, future-orientation, pattern prediction
- Velocity: Acceleration capacity, response speed, urgency navigation
- Leverage: Scaling cognition, pattern multiplication, systemic impact
- Signal: Information sensitivity, pattern recognition, noise filtering
- Fidelity: Verification depth, precision tolerance, error aversion
- Flex: Adaptability, context switching, perspective shifting
- Framework: Structural thinking, process orientation, systematic approach

LOOK FOR:
- Which dimensions suppress others under pressure
- Which dimensions compensate for weakness
- Masking patterns (appearing flat when concentrated)
- Concentration patterns (extreme on 1-2 dimensions)
- Distributed cognition (multi-system coordination)
- Relational compression (systems co-activated)
- Verification suppression (speed wins over accuracy)
- Acceleration gravity (pressure amplifies certain systems)

OUTPUT FORMAT:
Valid JSON only. No markdown wrapper. No code blocks. Pure JSON object.`;

  const instruction = `Analyze this person's profile comprehensively.

BASELINE SCORES (what the assessment shows):
${JSON.stringify(baselineForDisplay, null, 2)}

DETERMINISTIC TOPOLOGY (mathematical patterns):
${JSON.stringify(deterministic, null, 2)}

BEHAVIORAL EVIDENCE (canonical dossier):
- Written responses: ${JSON.stringify(evidence.written_responses).substring(0, 500)}...
- Contradictions: ${evidence.contradictions.length > 0 ? evidence.contradictions.map(c => c.description).join('; ').substring(0, 300) : 'None'}
- Stress patterns: ${JSON.stringify(evidence.stress_patterns).substring(0, 300)}...
- Communication: ${JSON.stringify(evidence.communication_style).substring(0, 200)}...
- Org effects: ${JSON.stringify(evidence.organizational_effects).substring(0, 300)}...

TASK:
1. Reinterpret each dimension with behavioral depth (preserve rankings and scores by default; adjust only if topology evidence demands it)
2. Identify primary/secondary system with confidence
3. Analyze spread type (flat, concentrated, extreme)
4. Detect tension patterns and suppression effects
5. Prepare "aha!" insights for rendering (command clarity, speed vs fidelity, strategic leverage)
6. Flag any discrepancies between deterministic topology and behavioral evidence
7. Treat all example numbers below as placeholders only. Do not copy them.

Return JSON matching this exact structure:
{
  "source": "gpt_behavioral_rescore",
  "model": "gpt-5.5",
  
  "ranked_dimensions": [
    {
      "dimension": "vector",
      "code": "VEC",
      "baseline_score": 0.0,
      "deterministic_score": 0.0,
      "gpt_rescored_score": 0.0,
      "display_score": 0.0,
      "role": "PRIMARY DRIVER | SECONDARY | STABILIZER | SUPPRESSED | DISTRIBUTED",
      "confidence": 0.88,
      "rationale": "2-3 sentence explanation grounded in evidence"
    }
    // ... 7 more dimensions (horizon, velocity, leverage, signal, fidelity, flex, framework)
  ],
  
  "dominance_profile": {
    "primary_dimension": "vector",
    "secondary_dimension": "horizon",
    "dominance_amplitude": "concentrated | balanced | flat | extreme",
    "spread_type": "concentrated | distributed | asymmetric",
    "profile_intensity": "low | moderate | high | extreme",
    "confidence": 0.91,
    "interpretation": "1 sentence on what this dominance pattern means behaviorally"
  },
  
  "spread_profile": {
    "flatness_score": 0.12,
    "polarization_score": 0.83,
    "balanced_vs_extreme": "balanced | moderate | concentrated | extreme"
  },
  
  "tension_pairs": {
    "velocity_vs_fidelity": {
      "pattern": "speed suppresses verification",
      "severity": "low | moderate | high",
      "confidence": 0.82,
      "behavioral_consequence": "one sentence"
    }
    // Include only significant tensions
  },
  
  "render_ready": {
    "profile_dna": "2-3 sentences on operating model (from full canonical interpretation)",
    "dna_summary": "1 line behavioral summary (15-20 words)",
    "command_clarity": "1 line on decision certainty (insight for metric card)",
    "speed_vs_fidelity": "1 line on speed-accuracy tradeoff (insight for metric card)",
    "strategic_leverage": "1 line on pattern scaling (insight for metric card)",
    "profile_intensity": "extreme | high | moderate | low",
    "dominance_flavor": "concentrated | strong | distributed | balanced"
  },
  
  "audit": {
    "changed_dimensions": [],
    "preserved_dimensions": ["vector", "horizon", ...],
    "reason_for_changes": [],
    "warning_flags": []
  }
}`;

  return {
    systemRule,
    section: 'behavioral_rescoring',
    canonical: canonical, // Pass full canonical for context
    instruction,
    format: 'json_strict'
  };
}

function normalizeProfileIntensityValue(value) {
  return value === 'medium' ? 'moderate' : value;
}

function normalizeProfileIntensity(rescoring_gpt) {
  if (rescoring_gpt?.render_ready?.profile_intensity) {
    rescoring_gpt.render_ready.profile_intensity = normalizeProfileIntensityValue(rescoring_gpt.render_ready.profile_intensity);
  }

  if (rescoring_gpt?.dominance_profile?.profile_intensity) {
    rescoring_gpt.dominance_profile.profile_intensity = normalizeProfileIntensityValue(rescoring_gpt.dominance_profile.profile_intensity);
  }
}

/**
 * Validate GPT rescoring output structure
 */
function validateGPTRescoreOutput(output, canonical, selectedModel = getModelForRoute('bos.rescoring')) {
  const errors = [];

  // Check source
  if (output.source !== 'gpt_behavioral_rescore') {
    errors.push('Invalid source field');
  }

  // Check model reflects the registry-selected route model
  if (output.model !== selectedModel) {
    errors.push('Invalid model field');
  }

  // Check ranked_dimensions array
  if (!Array.isArray(output.ranked_dimensions)) {
    errors.push('ranked_dimensions is not an array');
    return { valid: false, errors };
  }

  if (output.ranked_dimensions.length !== 8) {
    errors.push(`Expected 8 dimensions, got ${output.ranked_dimensions.length}`);
  }

  // Validate each dimension
  const expectedDimensions = ['vector', 'horizon', 'velocity', 'leverage', 'signal', 'fidelity', 'flex', 'framework'];
  const foundDimensions = new Set();

  output.ranked_dimensions.forEach((dim, idx) => {
    if (!dim.dimension) {
      errors.push(`Dimension ${idx} missing 'dimension' field`);
      return;
    }

    if (!expectedDimensions.includes(dim.dimension)) {
      errors.push(`Invalid dimension name: ${dim.dimension}`);
    }

    if (foundDimensions.has(dim.dimension)) {
      errors.push(`Duplicate dimension: ${dim.dimension}`);
    }
    foundDimensions.add(dim.dimension);

    if (typeof dim.gpt_rescored_score !== 'number' || dim.gpt_rescored_score < -10 || dim.gpt_rescored_score > 10) {
      errors.push(`Invalid gpt_rescored_score for ${dim.dimension}: ${dim.gpt_rescored_score}`);
    }

    if (typeof dim.confidence !== 'number' || dim.confidence < 0 || dim.confidence > 1) {
      errors.push(`Invalid confidence for ${dim.dimension}: ${dim.confidence}`);
    }

    if (!dim.rationale || typeof dim.rationale !== 'string' || dim.rationale.length < 20) {
      errors.push(`Missing or short rationale for ${dim.dimension}`);
    }
  });

  // Check dominance_profile
  if (!output.dominance_profile) {
    errors.push('Missing dominance_profile');
  } else {
    if (!output.dominance_profile.primary_dimension) {
      errors.push('dominance_profile missing primary_dimension');
    }
    if (typeof output.dominance_profile.confidence !== 'number') {
      errors.push('dominance_profile missing or invalid confidence');
    }
  }

  // Check render_ready - all five text fields required
  if (!output.render_ready) {
    errors.push('Missing render_ready');
  } else {
    const requiredFields = ['profile_dna', 'dna_summary', 'command_clarity', 'speed_vs_fidelity', 'strategic_leverage'];
    requiredFields.forEach(field => {
      if (!output.render_ready[field] || typeof output.render_ready[field] !== 'string') {
        errors.push('render_ready missing or invalid ' + field + ' (string required)');
      }
    });
    
    // Verify intensity and flavor fields
    const validIntensities = ['extreme', 'high', 'moderate', 'low'];
    if (!validIntensities.includes(output.render_ready.profile_intensity)) {
      errors.push('render_ready profile_intensity must be one of: extreme, high, moderate, low');
    }
    
    const validFlavors = ['concentrated', 'strong', 'distributed', 'balanced'];
    if (!validFlavors.includes(output.render_ready.dominance_flavor)) {
      errors.push('render_ready dominance_flavor must be one of: concentrated, strong, distributed, balanced');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Normalize GPT scores to ensure consistent scaling
 */
function normalizeGPTScores(rescoring_gpt, canonical) {
  const baseline = canonical.ranked_dimensions || [];
  
  rescoring_gpt.ranked_dimensions.forEach((dim) => {
    // Find baseline reference
    const baselineDim = baseline.find(b => b.dimension === dim.dimension);
    if (!baselineDim) return;

    // Ensure display_score equals gpt_rescored_score
    if (!dim.display_score) {
      dim.display_score = dim.gpt_rescored_score;
    }

    // Ensure scores are bounded
    dim.gpt_rescored_score = Math.max(-10, Math.min(10, dim.gpt_rescored_score));
    dim.display_score = Math.max(-10, Math.min(10, dim.display_score));

    // Preserve baseline for audit
    dim.baseline_score = baselineDim.score;

    // Store deterministic score if available
    if (canonical.rescoring_v1?.ranked_dimensions) {
      const v1Dim = canonical.rescoring_v1.ranked_dimensions.find(v => v.dimension === dim.dimension);
      if (v1Dim) {
        dim.deterministic_score = v1Dim.score;
      }
    }
  });
}

/**
 * Clamp broad upward score inflation back toward deterministic topology.
 */
function applyCalibrationGuardrails(rescoring_gpt, canonical) {
  const baseline = canonical.ranked_dimensions || [];
  const deterministic = canonical.rescoring_v1?.ranked_dimensions || [];
  const v1Spread = canonical.rescoring_v1?.spread_profile || {};
  const v1Dominance = canonical.rescoring_v1?.dominance_profile || {};
  const audit = rescoring_gpt.audit || { changed_dimensions: [], preserved_dimensions: [], reason_for_changes: [], warning_flags: [] };
  audit.changed_dimensions = Array.isArray(audit.changed_dimensions) ? audit.changed_dimensions : [];
  audit.preserved_dimensions = Array.isArray(audit.preserved_dimensions) ? audit.preserved_dimensions : [];
  audit.reason_for_changes = Array.isArray(audit.reason_for_changes) ? audit.reason_for_changes : [];
  audit.warning_flags = Array.isArray(audit.warning_flags) ? audit.warning_flags : [];

  if (!Array.isArray(rescoring_gpt.ranked_dimensions) || rescoring_gpt.ranked_dimensions.length === 0) {
    return;
  }

  const referenceFor = (dim) => {
    const v1Dim = deterministic.find(v => v.dimension === dim.dimension);
    const baselineDim = baseline.find(b => b.dimension === dim.dimension);
    return v1Dim?.score ?? baselineDim?.score ?? dim.gpt_rescored_score ?? 0;
  };

  const deltas = rescoring_gpt.ranked_dimensions.map(dim => {
    const reference = referenceFor(dim);
    return {
      dim,
      reference,
      delta: dim.gpt_rescored_score - reference
    };
  });

  const upward = deltas.filter(d => d.delta > 0.05);
  const totalUpward = deltas.reduce((sum, d) => sum + Math.max(0, d.delta), 0);
  const totalDownward = deltas.reduce((sum, d) => sum + Math.abs(Math.min(0, d.delta)), 0);
  const spreadType = String(v1Spread.balanced_vs_extreme || v1Dominance.spread_type || '').toLowerCase();
  const profileShape = String(v1Spread.profile_shape || '').toLowerCase();
  const preservesBalance = ['flat', 'balanced', 'distributed'].some(label => spreadType.includes(label) || profileShape.includes(label));
  const broadInflation = upward.length >= 6 || upward.length === rescoring_gpt.ranked_dimensions.length;
  const excessiveUpward = totalUpward > 2.4 && totalUpward > totalDownward + 1;
  const shouldClampBroadly = broadInflation && (excessiveUpward || preservesBalance);

  if (shouldClampBroadly) {
    audit.warning_flags.push({
      type: 'score_inflation_guardrail',
      message: 'Broad upward GPT score movement was clamped toward deterministic topology.',
      upward_dimensions: upward.length,
      total_upward_delta: Math.round(totalUpward * 100) / 100,
      v1_spread_type: v1Dominance.spread_type || v1Spread.balanced_vs_extreme || null,
      v1_profile_shape: v1Spread.profile_shape || null
    });
  }

  deltas.forEach(({ dim, reference, delta }) => {
    let maxPositiveDelta = shouldClampBroadly ? 0.3 : 0.75;
    let maxNegativeDelta = 0.75;

    if (preservesBalance) {
      maxPositiveDelta = Math.min(maxPositiveDelta, 0.3);
      maxNegativeDelta = Math.min(maxNegativeDelta, 0.5);
    }

    if (Math.abs(delta) > 1.0) {
      audit.warning_flags.push({
        type: 'large_score_delta',
        dimension: dim.dimension,
        original_delta: Math.round(delta * 100) / 100,
        message: 'Score movement over 1.0 requires exceptional independent evidence.'
      });
    }

    if (delta > maxPositiveDelta) {
      dim.gpt_rescored_score = Math.round((reference + maxPositiveDelta) * 100) / 100;
      dim.display_score = dim.gpt_rescored_score;
    } else if (delta < -maxNegativeDelta) {
      dim.gpt_rescored_score = Math.round((reference - maxNegativeDelta) * 100) / 100;
      dim.display_score = dim.gpt_rescored_score;
    }
  });

  rescoring_gpt.audit = audit;
}

/**
 * Enrich audit trail
 */
function enrichAuditTrail(rescoring_gpt, canonical) {
  const baseline = canonical.ranked_dimensions || [];
  const audit = rescoring_gpt.audit || { changed_dimensions: [], preserved_dimensions: [], reason_for_changes: [], warning_flags: [] };

  rescoring_gpt.ranked_dimensions.forEach((dim) => {
    const baselineDim = baseline.find(b => b.dimension === dim.dimension);
    if (!baselineDim) return;

    const scoreChange = Math.abs(dim.gpt_rescored_score - baselineDim.score);
    
    if (scoreChange > 0.3) {
      // Significant change
      if (!audit.changed_dimensions.includes(dim.dimension)) {
        audit.changed_dimensions.push(dim.dimension);
      }
      if (dim.rationale && !audit.reason_for_changes.includes(dim.rationale)) {
        audit.reason_for_changes.push({
          dimension: dim.dimension,
          reason: dim.rationale,
          score_delta: scoreChange
        });
      }
    } else {
      // Preserved
      if (!audit.preserved_dimensions.includes(dim.dimension)) {
        audit.preserved_dimensions.push(dim.dimension);
      }
    }
  });

  rescoring_gpt.audit = audit;
  rescoring_gpt.generated_at = new Date().toISOString();
}

export default gptBehavioralRescore;
