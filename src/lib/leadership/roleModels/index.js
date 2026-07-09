/**
 * Leadership Role Fit — role model registry.
 * Future models (Team Leader, Regional Director, Recruiter, Custom) register here.
 */

import {
  FATHOM_DISTRICT_DIRECTOR_V1,
  FATHOM_DD_ROLE_MODEL_ID,
} from './fathomDistrictDirectorV1.js';

const ROLE_MODEL_REGISTRY = {
  [FATHOM_DD_ROLE_MODEL_ID]: FATHOM_DISTRICT_DIRECTOR_V1,
};

export function listRoleModels() {
  return Object.values(ROLE_MODEL_REGISTRY).map((model) => ({
    role_model_id: model.role_model_id,
    label: model.label,
    short_label: model.short_label,
    version: model.version,
    organization: model.organization,
  }));
}

export function getRoleModel(roleModelId) {
  if (!roleModelId) return null;
  return ROLE_MODEL_REGISTRY[roleModelId] || null;
}

export function getDefaultDistrictDirectorRoleModel() {
  return FATHOM_DISTRICT_DIRECTOR_V1;
}

export {
  FATHOM_DISTRICT_DIRECTOR_V1,
  FATHOM_DD_ROLE_MODEL_ID,
};

export default ROLE_MODEL_REGISTRY;
