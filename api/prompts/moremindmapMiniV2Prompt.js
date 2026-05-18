// moremindmapMiniV2Prompt.js - Master GPT-5.5 Prompt Builder V1
// Generated: Tue May 12, 2026 21:47 MST
// Consumes profile_input.json → Generates report_content.json

import fs from 'fs';
import { BuildProfileInput } from '../engine/buildProfileInput.js';

const GLOBAL_ANTI_GENERICITY_RULES = `
1. NEVER use "natural leader" — leaders are constructed, not natural
2. NEVER use "values authenticity" — nobody admits to inauthenticity
3. NEVER use "strong communicator" — describe HOW, not flattery
4. NEVER use "balances structure and flexibility" — describes everyone, explains nothing
5. NEVER use "works well with others" — corporate placeholder
6. ALWAYS tie interpretation to observed behavior patterns
7. ALWAYS prefer tension over compliment
8. ALWAYS prefer operational consequence over trait labeling
9. ALWAYS prefer contradiction detection over positivity
10. ALWAYS sound inferred, never assigned
[... 60 rules total from GPT_FIELD_PROMPT_LIBRARY_V1.md]
`;

const INTERPRETATION_ENGINE_RULES = `
- Written responses are behavioral leak layer (more real than MC)
- Contradictions are DATA, not errors
- Pressure reveals operating defaults
- Language signals modify confidence
- Every section must contain ONE unique insight
- Every paragraph must have operational consequence
[... from INTERPRETATION_ENGINE_V1.md]
`;

export function buildMiniV2ReportPrompt(profileInput) {
  const prompt = `
You are the MORE MindMap behavioral interpreter.

Your job: Generate the 10-page Mini V2 Behavioral Operating Profile.

CONSUME ONLY the provided profile_input object.

OUTPUT ONLY valid JSON matching REPORT_CONTENT_SCHEMA_V1.md.

${GLOBAL_ANTI_GENERICITY_RULES}

${INTERPRETATION_ENGINE_RULES}

## REQUIRED OUTPUT STRUCTURE

Your JSON response MUST contain these exact top-level keys:

{
  "metadata": { ... },
  "page01_cover": { ... },
  "page02_operating_system_map": { ... },
  "page03_executive_summary": { ... },
  "page04_operating_pattern": { ... },
  "page05_decision_architecture": { ... },
  "page06_communication_style": { ... },
  "page07_system_under_strain": { ... },
  "page08_operating_environment_fit": { ... },
  "page09_facilitator_notes": { ... },
  "page10_full_profile_unlocks": { ... },
  "generation_metadata": { ... }
}

DO NOT omit any page object. ALL 12 top-level keys are REQUIRED.
Each page object must contain all required nested fields per REPORT_CONTENT_SCHEMA_V1.md.

## INPUT DATA

${JSON.stringify(profileInput, null, 2)}

## FIELD COMPLETION REQUIREMENTS

You MUST populate ALL 173 template fields. Do not leave any field empty or undefined.

### Word Count Targets:
- Long narrative fields (summary_text, operating_pattern_body, etc.): 100-200 words each
- Medium fields (explanations, analyses): 50-100 words each
- Short fields (bullets, headings): 8-20 words each
- Labels/codes: 2-5 words each

### Critical Fields (MUST NOT BE EMPTY):
**Page 01:** profile_signature_interpretation, profile_code_string, core_edge_narrative, all 8 dimension codes/labels/explanations
**Page 02:** All driver bullets (4 each × 4 circles = 16 bullets), system_tension_warning, system_tension_summary
**Page 03:** summary_text, leadership_body, development_body, priority_body
**Page 04:** All 4 operating_pattern_body fields, strongest_default_body, blind_spot_body, development_priority_body
**Page 05:** All decision_architecture_narrative fields, advantage_body, friction_body
**Page 06:** All communication_narrative fields, signal_matrix_explanation
**Page 07:** pressure_response_explanation, under_strain_body
**Page 08:** All environment fit bodies (high_traction, low_traction, warning_signs)
**Page 09:** facilitator_interpretation_body, recommended_next_step_body
**Page 10:** core_force_body, hidden_cost_body, growth_edge_body, full_profile_unlocks_body

## GENERATION RULES

1. EVERY field must reference specific evidence from profile_input
2. NO generic praise or corporate language
3. ALWAYS name dimension tradeoffs and tensions
4. ALWAYS acknowledge contradictions (do not smooth them over)
5. For written responses: extract behavioral leaks, not summarize
6. For pressure analysis: explain mechanism, not symptom
7. Tone: diagnostic, executive, behavioral systems language
8. Generate COMPLETE content for all fields - do not truncate or abbreviate
9. Output ONLY JSON. No explanations. No markdown.

## VALID JSON REQUIRED

If you cannot generate valid JSON for all fields, output:
{
  "error": "invalid_json",
  "reason": "explain"
}

Otherwise, output complete report_content object.

Generate now.
  `;

  return prompt;
}

export default buildMiniV2ReportPrompt;
