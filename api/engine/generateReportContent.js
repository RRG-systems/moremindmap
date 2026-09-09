/* global process */
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

const DEFAULT_TEMPERATURE_MODEL_PATTERN = /^(gpt-5|o\d|o[134]|chatgpt-4o)/iu;

export function usesDefaultBosReportTemperature(model) {
  return DEFAULT_TEMPERATURE_MODEL_PATTERN.test(String(model || ''));
}

export function buildBosReportCompletionRequest({ prompt, model = MODEL } = {}) {
  const resolvedModel = String(model || '').trim();
  if (!resolvedModel) throw governedGenerationError('BOS_REPORT_MODEL_NOT_CONFIGURED');
  const request = {
    model: resolvedModel,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    max_completion_tokens: 16000,
    response_format: { type: 'json_object' },
  };
  if (!usesDefaultBosReportTemperature(resolvedModel)) request.temperature = 0.3;
  return request;
}

function governedGenerationError(code) {
  return new Error(code);
}

export function assertGovernedReportContent(reportContent) {
  if (!reportContent
      || typeof reportContent !== 'object'
      || Array.isArray(reportContent)
      || reportContent.generation_metadata?.generation_mode !== 'gpt'
      || /\[mock\]/iu.test(JSON.stringify(reportContent))) {
    throw governedGenerationError('BOS_REPORT_GOVERNED_CONTENT_REQUIRED');
  }
  return reportContent;
}

export async function generateReportContent(inputProfile = null, missingFields = null, providerOptions = {}) {
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
  
  const result = await generateWithGPT(prompt, providerOptions);
  const content = validateAndProcessGPTOutput(result.output, Boolean(missingFields), {
    model: result.model,
    temperature: result.temperature,
  });
  assertGovernedReportContent(content);
  if (!missingFields) {
    writeReportContent(content);
  }
  return content;
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

export async function generateWithGPT(prompt, {
  apiKey = process.env.OPENAI_API_KEY,
  model = MODEL,
  clientFactory = (resolvedApiKey) => new OpenAI({ apiKey: resolvedApiKey }),
} = {}) {
  if (!String(apiKey || '').trim()) {
    throw governedGenerationError('BOS_REPORT_PROVIDER_NOT_CONFIGURED');
  }

  const request = buildBosReportCompletionRequest({ prompt, model });
  let completion;
  try {
    const openai = clientFactory(apiKey);
    completion = await openai.chat.completions.create(request);
  } catch (error) {
    console.error('BOS report provider request failed', {
      status: Number.isInteger(error?.status) ? error.status : null,
      code: 'BOS_REPORT_PROVIDER_REQUEST_FAILED',
    });
    throw governedGenerationError('BOS_REPORT_PROVIDER_REQUEST_FAILED');
  }

  const responseText = completion?.choices?.[0]?.message?.content;
  const responseModel = typeof completion?.model === 'string' ? completion.model.trim() : '';
  if (typeof responseText !== 'string' || !responseText.trim() || !responseModel) {
    throw governedGenerationError('BOS_REPORT_PROVIDER_RESPONSE_INVALID');
  }

  let output;
  try {
    output = JSON.parse(responseText);
  } catch {
    throw governedGenerationError('BOS_REPORT_PROVIDER_RESPONSE_INVALID');
  }
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    throw governedGenerationError('BOS_REPORT_PROVIDER_RESPONSE_INVALID');
  }

  return {
    generation_mode: 'gpt',
    model: responseModel,
    temperature: Object.hasOwn(request, 'temperature') ? request.temperature : null,
    output,
  };
}

export function validateAndProcessGPTOutput(output, isRepairPass = false, {
  model = MODEL,
  temperature = null,
} = {}) {
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
      model_used: model,
      temperature: temperature ?? 'provider_default',
      validation_passed: genericityHits.length === 0
    }
  };

  if (genericityHits.length > 0) {
    console.warn('Genericity detected:', genericityHits);
  }

  return content;
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
