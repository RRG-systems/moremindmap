// Render-only guard. The service remains authoritative for every read and write.
export function youthIntakeGate(dossier, policyVersion, service = 'bos') {
  if (!dossier || dossier.person?.age >= 18) return null;
  if (!(dossier.person?.age >= 13)) return 'age';
  const participation = dossier.participation || {};
  if (participation.status === 'withdrawn') return 'withdrawn';
  if (dossier.entitlements?.[service] !== true) return 'academy';
  if (participation.athleteAccepted !== true || participation.policyVersion !== policyVersion) return 'review';
  if (participation.status !== 'authorized' || !participation.guardianId ||
    participation.guardianPolicyVersion !== policyVersion) return 'guardian';
  return null;
}
