import { performance } from 'node:perf_hooks';

import {
  RECRUITING_GU_COACH_MOVE_SCHEMA,
  RECRUITING_GU_EXPERIMENT_2_VERSION,
  validateRecruitingGuCoachMove,
} from '../../../src/lib/recruitingGuV1/experiment2Contract.js';
import { buildRecruitingGuCoachMessages } from './experiment2Prompt.js';

export function createRecruitingGuCoachRuntime({ transport, modelConfig, maxAttempts = 2 } = {}) {
  if (typeof transport !== 'function') throw new Error('RECRUITING_GU_V1_COACH_TRANSPORT_REQUIRED');

  async function coach({ world, sessionContext, purpose, purposeContext = null, demonstrations = [] }) {
    const startedAt = performance.now();
    const attempts = [];
    let repair = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const messages = buildRecruitingGuCoachMessages({
        world,
        sessionContext,
        humanPurpose: purpose,
        purposeContext,
        demonstrations,
        repair,
      });
      const response = await transport({
        messages,
        schema: RECRUITING_GU_COACH_MOVE_SCHEMA,
        schemaName: 'more_recruiting_gu_v1_experiment_2_coach_move',
      });
      const validation = validateRecruitingGuCoachMove({ candidate: response.parsed, governedWorld: world, purposeContext });
      attempts.push(Object.freeze({ attempt, validation, receipt: response.receipt }));
      if (validation.ok) {
        const totalLatencyMs = Math.round(performance.now() - startedAt);
        return Object.freeze({
          move: Object.freeze(structuredClone(response.parsed)),
          receipt: Object.freeze({
            runtime: RECRUITING_GU_EXPERIMENT_2_VERSION,
            stage: 'COACH',
            modelConfig,
            attempts: attempts.length,
            repairEvents: attempts.filter((item) => !item.validation.ok).map((item) => item.validation.errors),
            provider: response.receipt,
            totalLatencyMs,
            promptCharacters: messages.reduce((sum, item) => sum + item.content.length, 0),
            governedWorldCharacters: JSON.stringify(world).length,
            purposeContextCharacters: purposeContext ? JSON.stringify(purposeContext).length : 0,
            demonstrationCount: demonstrations.length,
            rawRequestPersisted: false,
            rawResponsePersisted: false,
            store: false,
          }),
        });
      }
      repair = { candidate: response.parsed, errors: validation.errors };
    }
    const error = new Error('RECRUITING_GU_V1_COACH_MOVE_FAILED_CLOSED');
    error.code = 'RECRUITING_GU_V1_COACH_MOVE_FAILED_CLOSED';
    error.validationErrors = attempts.at(-1)?.validation?.errors || [];
    error.attempts = attempts.length;
    throw error;
  }

  return Object.freeze({ coach, modelConfig });
}
