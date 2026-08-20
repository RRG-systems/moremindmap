import { SURFACES } from './constants.js';

export const LIBRARY_MANIFEST_SHA256 = 'bab4239d539c08e8997c9f16b349a9ed53f88156937ff11ac8f3aebc47f96625';

export const BOS_LIBRARY = Object.freeze([
  ['01', 'Eight-Vector Personality', 'f672791f753bd66133d630f430b5a2d498371a430ed60863bcb80a2fefac558f'],
  ['02', 'Cross-Vector Interaction', 'a611d2dc04f7b5ad8394c2cb3172a092f671cd5916c5a313a1cf088a4890366a'],
  ['03', 'Higher-Order Behavioral Attribute', '63f61dba7927cc6e1348c59c0682412ff63f95e268cbda76f1dcac60fd7dda76'],
  ['04', 'Causal Behavioral Dynamics', '9d06dac5914b009b822cc3b7f7a51f40ccb26ab1c172eff705d0382af8b1230b'],
  ['05', 'Pressure, Conflict, Recovery', '2c83aedffa9ffb9b97d9084b78f812e81770313eec9cafa329d1cb28396ddb1d'],
  ['06', 'Communication and Interaction', '15dac431d3241cc94868bb9d57adcb5f14aa5383a925b6aa3b7b34f56d5491e2'],
  ['07', 'Work-Environment Fit', '4053d3451d0b3743cddde46a32b5f6bb3cac879e5ca1ddb85739ca25cc3521d0'],
  ['08', 'Role and Seat', 'e9bf77f0d16f3aa182e1b9dd03fd168030f5693d51ae82c11a052884dda1c9ef'],
  ['09', 'Leadership', 'ab8ef808a30152f9f1b69cdefeaf8454c43b20616d53a14138ff76e4d4b5cdce'],
  ['10', 'Cognitive Operating Style', '403b3b36f84371c8f65a591a6c71bf329bc47a0b23866461d803875ae487c54f'],
  ['11', 'Personal Operating Energy', 'a597a475c8e539557289d108e5379fab556a5961daa3cfcf6d8f7b5d363fac76'],
  ['12', 'Five Futures Behavioral Trajectory', 'd22b4d39ff5cb97f98854c2a372110a828c98e18e86a18dc6b7b589d99dcb3c4'],
  ['13', 'One Move Intervention', 'a7cdca2a3e8e22cc3b7f05b2a7de4e8e1002d5c39164cdaf9acd737012c8d84f'],
  ['14', 'Evidence, Certainty, Validation', 'd13cba17bcfde27349813bb7f474f4edecbafec78ab4ea7da6c5771e9552bbc1'],
  ['15', 'Personality DNA Synthesis', '03acbba01d099a14adbe2e0adb028c7e56eecdf5b45b5dfbd3102cbcbbf22606'],
].map(([id, title, sha256]) => Object.freeze({
  id: Number(id),
  title,
  sha256,
  version: 'V1',
}))); 

const STAGE_BIBLES = Object.freeze({
  vector_priors: [1, 14],
  cross_vector_topology: [2, 14],
  higher_order_attributes: [3, 10, 11, 14],
  causal_dynamics: [4, 14],
  specialized_intelligence: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  evidence_certainty: [14],
  personality_dna: [15, 14, 2, 3, 4],
  whole_person_model: [15, 14],
});

function entries(ids) {
  return ids.map((id) => BOS_LIBRARY.find((item) => item.id === id));
}

export function selectLibraryForStage(stageId) {
  const ids = STAGE_BIBLES[stageId];
  if (!ids) throw new Error(`Unknown library stage: ${stageId}`);
  return Object.freeze({
    stage_id: stageId,
    manifest_sha256: LIBRARY_MANIFEST_SHA256,
    authorities: Object.freeze(entries(ids)),
    retrieval_policy: 'purpose_specific_hash_bound_blocks_only',
  });
}

export function selectLibraryForSurface(surfaceId) {
  const surface = SURFACES.find((item) => item.id === surfaceId);
  if (!surface) throw new Error(`Unknown BOS surface: ${surfaceId}`);
  return Object.freeze({
    surface_id: surfaceId,
    manifest_sha256: LIBRARY_MANIFEST_SHA256,
    authorities: Object.freeze(entries(surface.bibleIds)),
    retrieval_policy: 'whole_person_context_plus_local_surface_authorities',
  });
}
