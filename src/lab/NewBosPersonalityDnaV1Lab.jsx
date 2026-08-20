import { useEffect, useMemo, useState } from 'react';
import NewBosExperience from '../components/newBosPersonalityDnaV1/NewBosExperience.jsx';
import { buildPersonalityDnaRuntime } from '../lib/newBosPersonalityDnaV1/engine.js';
import { SYNTHETIC_FIXTURES } from '../lib/newBosPersonalityDnaV1/syntheticFixtures.js';

const REAL_AMBER_CANDIDATES = Object.freeze({
  'real-amber-hs-gate-v1': '/docs/new-bos-personality-dna-v1/real-amber-hs-gate-v1/REAL_AMBER_NEW_BOS_CANDIDATE_V1.json',
  'real-amber-human-realization-v4': '/docs/new-bos-personality-dna-v1/full-bos-human-realization-v1/REAL_AMBER_REGENERATED_CANDIDATE_V1.json',
  'real-amber-surface-mission-v1': '/docs/new-bos-personality-dna-v1/surface-mission-realization-v1/REAL_AMBER_SURFACE_MISSION_CANDIDATE_V1.json',
  'real-amber-five-surgical-polish-v1': '/docs/new-bos-personality-dna-v1/five-surgical-polish-v1/REAL_AMBER_FIVE_SURGICAL_POLISH_CANDIDATE_V1.json',
});

export default function NewBosPersonalityDnaV1Lab() {
  const enabled = import.meta.env.VITE_NEW_BOS_PERSONALITY_DNA_V1 === 'true';
  const realGateEnabled = import.meta.env.VITE_REAL_AMBER_HS_GATE_V1 === 'true';
  const requestedCandidate = new URLSearchParams(window.location.search).get('candidate');
  const realCandidateUrl = REAL_AMBER_CANDIDATES[requestedCandidate];
  const realGateRequested = Boolean(realCandidateUrl);
  const [realCandidate, setRealCandidate] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const syntheticArtifacts = useMemo(
    () => SYNTHETIC_FIXTURES.map((fixture) => buildPersonalityDnaRuntime(fixture)),
    [],
  );

  useEffect(() => {
    if (!enabled || !realGateEnabled || !realGateRequested) return undefined;
    const controller = new AbortController();
    fetch(realCandidateUrl, { cache: 'no-store', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Private candidate load failed (${response.status})`);
        return response.json();
      })
      .then((artifact) => {
        if (artifact.profile_id !== 'MM-20260617-YBNWT0KS' || artifact.real_profile_gate !== true) {
          throw new Error('Private candidate identity mismatch');
        }
        setRealCandidate(artifact);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setLoadError(error.message);
      });
    return () => controller.abort();
  }, [enabled, realCandidateUrl, realGateEnabled, realGateRequested]);
  if (!enabled) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#172127', color: '#f7f1e6' }}>
        <section style={{ maxWidth: 680 }}>
          <p style={{ color: '#f0a178', textTransform: 'uppercase', letterSpacing: '.14em', fontWeight: 800 }}>Default-off synthetic lab</p>
          <h1 style={{ font: '400 3.5rem/1 Georgia, serif', margin: '10px 0 20px' }}>New BOS Personality DNA V1 is not enabled.</h1>
          <p style={{ color: 'rgba(255,255,255,.68)', lineHeight: 1.7 }}>Set VITE_NEW_BOS_PERSONALITY_DNA_V1=true in a local process to exercise the isolated synthetic product proof. No customer retrieval or production activation is connected to this route.</p>
        </section>
      </main>
    );
  }
  if (realGateRequested && !realGateEnabled) {
    return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#172127', color: '#f7f1e6' }}><p>Private real-profile gate is not enabled in this local process.</p></main>;
  }
  if (loadError) {
    return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#172127', color: '#f7f1e6' }}><p>{loadError}</p></main>;
  }
  if (realGateRequested && !realCandidate) {
    return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#172127', color: '#f7f1e6' }}><p>Loading private Amber gate candidate…</p></main>;
  }
  return (
    <NewBosExperience
      artifactOverride={realCandidate}
      artifactChoices={syntheticArtifacts}
      privateGate={Boolean(realCandidate)}
    />
  );
}
