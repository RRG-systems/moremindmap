// generateReportContent.js - GPT-5.5 Report Content Generation V1
// Generated: Tue May 12, 2026 21:47 MST
// Input: profile_input.json → Output: report_content.json

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { buildMiniV2ReportPrompt } from '../prompts/moremindmapMiniV2Prompt.js';
import { BuildProfileInput } from './buildProfileInput.js';
import { groupMissingFieldsByPage } from './miniV2FieldMap.js';
import { getModelForRoute } from './config/modelRegistry.js';

const MODEL = getModelForRoute('bos.report');
const API_KEY = process.env.OPENAI_API_KEY;

export async function generateReportContent(inputProfile = null, missingFields = null) {
  const profileInput = inputProfile || loadProfileInputExample();
  
  // If this is a repair pass, group fields by page and use targeted repair prompt
  let prompt;
  if (missingFields) {
    const { grouped, unmapped } = groupMissingFieldsByPage(missingFields);
    
    if (unmapped.length > 0) {
      console.warn(`[REPAIR] ${unmapped.length} fields cannot be mapped, skipping:`, unmapped.slice(0, 10));
    }
    
    prompt = buildMissingFieldRepairPrompt(profileInput, grouped);
  } else {
    prompt = buildMiniV2ReportPrompt(profileInput);
  }
  
  const result = await generateWithGPT(prompt);
  
  if (result.generation_mode === 'gpt') {
    const content = validateAndProcessGPTOutput(result.output, missingFields ? true : false);
    if (!missingFields) {
      writeReportContent(content);
    }
    return content;
  } else {
    const mockContent = generateMockContent(profileInput);
    if (!missingFields) {
      writeReportContent(mockContent);
    }
    return mockContent;
  }
}

function loadProfileInputExample() {
  const examplePath = path.join(process.cwd(), 'examples', 'profile_input_example.json');
  if (fs.existsSync(examplePath)) {
    return JSON.parse(fs.readFileSync(examplePath, 'utf8'));
  }
  
  // Generate minimal profile input if example doesn't exist
  const builder = new BuildProfileInput();
  const rawAssessment = generateMockRawAssessment();
  return builder.build(rawAssessment);
}

async function generateWithGPT(prompt) {
  if (!API_KEY) {
    console.log('No OPENAI_API_KEY found. Using mock mode.');
    return { generation_mode: 'mock' };
  }

  const openai = new OpenAI({ apiKey: API_KEY });
  
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_completion_tokens: 16000,
      response_format: { type: 'json_object' }
    });

    const output = completion.choices[0].message.content;
    return {
      generation_mode: 'gpt',
      model: MODEL,
      output: JSON.parse(output),
      raw_prompt: prompt.substring(0, 1000) + '...'
    };
  } catch (error) {
    console.error('GPT generation failed:', error.message);
    return { generation_mode: 'mock', error: error.message };
  }
}

function validateAndProcessGPTOutput(output, isRepairPass = false) {
  // Log actual keys received from GPT for debugging
  console.log('[GPT OUTPUT] Top-level keys:', Object.keys(output).sort());
  
  // For repair pass, don't require all top-level keys (only what's being repaired)
  if (!isRepairPass) {
    const requiredKeys = [
      'metadata',
      'page01_cover', 'page02_operating_system_map', 'page03_executive_summary',
      'page04_operating_pattern', 'page05_decision_architecture', 'page06_communication_style',
      'page07_system_under_strain', 'page08_operating_environment_fit', 'page09_facilitator_notes',
      'page10_full_profile_unlocks',
      'generation_metadata'
    ];

    const missingKeys = requiredKeys.filter(key => !output[key]);
    if (missingKeys.length > 0) {
      console.error('[GPT OUTPUT] Missing keys:', missingKeys);
      console.error('[GPT OUTPUT] Received keys:', Object.keys(output));
      throw new Error(`Missing required keys: ${missingKeys.join(', ')}`);
    }
  }

  // Anti-genericity check
  const bannedPhrases = [
    'natural leader', 'strong communicator', 'values authenticity', 'works well with others',
    'balances structure and flexibility', 'results-oriented', 'team player', 'growth mindset',
    'unlock your potential', 'passionate about', 'visionary leader', 'detail-oriented'
  ];

  const genericityHits = bannedPhrases.filter(phrase => 
    JSON.stringify(output).toLowerCase().includes(phrase)
  );

  const content = {
    ...output,
    generation_metadata: {
      genericity_score: genericityHits.length / bannedPhrases.length,
      banned_phrases_detected: genericityHits,
      contradiction_count: output.contradiction_count || 0,
      written_integration_count: output.written_integration_count || 0,
      quality_flags: genericityHits.length === 0 ? ['high_diagnostic', 'no_genericity'] : [],
      generation_mode: 'gpt',
      model_used: MODEL,
      temperature: 0.3,
      validation_passed: genericityHits.length === 0
    }
  };

  if (genericityHits.length > 0) {
    console.warn('Genericity detected:', genericityHits);
  }

  return content;
}

function generateMockContent(profileInput) {
  return {
    metadata: {
      profile_version: 'mini-v2',
      generation_date: new Date().toISOString(),
      generation_mode: 'mock'
    },
    page01_cover: {
      profile_signature_interpretation: '[MOCK] Command-speed operator with relational blind spots. Moves fast, misses resistance.',
      profile_code_string: 'V35F28L12H23S18X24',
      core_edge_narrative: '[MOCK] Core edge: fast clarity in execution phases. Hidden cost: late discovery of stakeholder misalignment.',
      confidence_level: 'Moderate',
      profile_type: 'Command-Precision'
    },
    page02_operating_system_map: {
      system_tension_warning: '[MOCK] Vector preference creates unread relational resistance.',
      core_engine_heading: 'Command-Speed Engine',
      primary_driver_name: 'Vector (Command)',
      primary_driver_bullet_1: '[MOCK] Enters with direction forming',
      // ... abbreviated for brevity
    },
    page03_executive_summary: {
      summary_text: '[MOCK] High command + moderate precision creates execution strength with relational cost. Primary tension: speed vs stakeholder alignment.'
    },
    page04_operating_pattern: {
      operating_pattern_body_1: '[MOCK] Natural operating pattern: identify problem → decide → explain → execute.'
    },
    page05_decision_architecture: {
      decision_architecture_narrative_1: '[MOCK] Decision style: clarity-seeking. Prefers clear answer over multiple valid options.'
    },
    page06_communication_style: {
      signal_matrix_explanation: '[MOCK] Moderate signal means you catch major dynamics but miss subtle resistance.'
    },
    page07_system_under_strain: {
      pressure_response_explanation: '[MOCK] Under strain: tighter structure, faster decisions. Teams feel shutdown.'
    },
    page08_operating_environment_fit: {
      high_traction_environments_body: '[MOCK] Thrives in execution-focused, clear-goal environments.'
    },
    page09_facilitator_notes: {
      facilitator_interpretation_body: '[MOCK] Coaching note: Frame input-gathering as decision-making, not hesitation.'
    },
    page10_full_profile_unlocks: {
      core_force_heading: 'Command Clarity',
      hidden_cost_heading: 'Unread Resistance'
    },
    generation_metadata: {
      genericity_score: 0.0,
      banned_phrases_detected: [],
      quality_flags: ['mock_mode', 'schema_complete'],
      generation_mode: 'mock',
      validation_passed: true
    }
  };
}

function writeReportContent(content) {
  // Disabled in serverless environment - no filesystem write access
  // const outputPath = path.join(process.cwd(), 'examples', 'report_content_example.json');
  // fs.writeFileSync(outputPath, JSON.stringify(content, null, 2));
  console.log(`[REPORT CONTENT] Content generated (${Object.keys(content).length} fields)`);
}

function generateMockRawAssessment() {
  return {
    assessment_id: 'mock-assess-001',
    answers: {
      q1: { choice: 'A' },
      q2: { text: 'Team misunderstood my direction because they were slow to adapt. I had to push harder.' },
      q3: { choice: 'B' },
      // ... abbreviated mock data
      q24: { text: 'Under pressure I tighten structure and move faster. It gets things done but can feel intense to team.' }
    },
    duration_seconds: 1200
  };
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  generateReportContent().then(content => {
    console.log('✅ Generation complete');
    console.log(`Mode: ${content.generation_metadata.generation_mode}`);
    console.log(`Genericity score: ${content.generation_metadata.genericity_score}`);
    console.log('Pages generated:', Object.keys(content).filter(k => k.startsWith('page')).length);
  }).catch(error => {
    console.error('❌ Generation failed:', error.message);
    process.exit(1);
  });
}

function buildMissingFieldRepairPrompt(profileInput, missingFieldsGrouped) {
  // missingFieldsGrouped is { pageKey: [field1, field2, ...] }
  let fieldListByPage = '';
  Object.keys(missingFieldsGrouped).forEach(pageKey => {
    const fields = missingFieldsGrouped[pageKey];
    fieldListByPage += `\n\n### ${pageKey}\n- ` + fields.join('\n- ');
  });
  
  return `
You are completing a MORE MindMap behavioral profile. 

The first-pass generation left some fields empty. Your job: populate ONLY the missing fields listed below.

## PROFILE INPUT

${JSON.stringify(profileInput, null, 2)}

## MISSING FIELDS TO POPULATE (BY PAGE)
${fieldListByPage}

## RULES

1. Return ONLY valid JSON with nested page objects
2. Each field must reference specific evidence from profile_input
3. Use behavioral systems language (NOT generic corporate fluff)
4. Word counts:
   - Narrative fields: 80-150 words
   - Bullets: 8-15 words
   - Labels/headings: 2-5 words
   - Icons: single emoji character
5. Page 2 fields: keep compact (visual-first page)
6. Pages 3-8 fields: robust interpretation (core content)
7. NO markdown. NO explanations. ONLY JSON.

## OUTPUT FORMAT

Return JSON with ONLY the page objects containing missing fields.

Example:
{
  "page03_executive_summary": {
    "leadership_heading": "...",
    "development_body": "..."
  },
  "page05_decision_architecture": {
    "decision_architecture_narrative_1": "..."
  }
}

Generate now.
`;
}

export default generateReportContent;
export { buildMissingFieldRepairPrompt };
