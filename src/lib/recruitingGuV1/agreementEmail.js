function clean(value, max = 2000) {
  return String(value || '').trim().replace(/\s+/gu, ' ').slice(0, max);
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatAgreedPlanText(plan) {
  const title = clean(plan?.title, 160);
  const summary = clean(plan?.summary, 700);
  const commitments = Array.isArray(plan?.commitments) ? plan.commitments : [];
  const unresolved = Array.isArray(plan?.unresolved) ? plan.unresolved.map((item) => clean(item, 260)).filter(Boolean) : [];
  if (!title || !summary || commitments.length < 1) throw new Error('CONSULTING_AGREED_PLAN_EMAIL_SNAPSHOT_INVALID');
  const steps = commitments.map((item, index) => [
    `${index + 1}. ${clean(item.owner, 120)} — ${clean(item.commitment, 420)}`,
    `Timing: ${clean(item.timing, 160)}`,
    `Intended outcome: ${clean(item.intendedOutcome, 300)}`,
  ].join('\n'));
  return [
    title,
    summary,
    'Agreed next steps',
    ...steps,
    ...(unresolved.length ? ['Still to resolve', ...unresolved.map((item) => `- ${item}`)] : []),
  ].join('\n\n');
}

export function buildConsultingAgreementEmail({ acceptedPlanSnapshot } = {}) {
  const plan = acceptedPlanSnapshot?.plan;
  const planText = formatAgreedPlanText(plan);
  const commitments = plan.commitments.map((item, index) => `
    <li style="margin:0 0 18px;padding:16px;border:1px solid #dbe7e2;border-radius:12px;background:#f7fbf9;">
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#176b55;">${index + 1}. ${escapeHtml(clean(item.owner, 120))} · ${escapeHtml(clean(item.timing, 160))}</div>
      <div style="margin-top:7px;font-size:17px;font-weight:700;color:#13211d;">${escapeHtml(clean(item.commitment, 420))}</div>
      <div style="margin-top:7px;font-size:14px;line-height:1.5;color:#4c5d57;">${escapeHtml(clean(item.intendedOutcome, 300))}</div>
    </li>`).join('');
  const unresolved = Array.isArray(plan.unresolved) && plan.unresolved.length
    ? `<div style="margin-top:22px;padding:14px 16px;border-left:3px solid #d89b35;background:#fff9ed;"><strong>Still to resolve</strong><ul>${plan.unresolved.map((item) => `<li>${escapeHtml(clean(item, 260))}</li>`).join('')}</ul></div>`
    : '';
  const opening = 'Congratulations — you and your manager agreed on the next steps.';
  const closing = 'This is the plan you agreed to and can use as the shared reference for the work ahead.';
  return Object.freeze({
    contract: 'more_consulting_agreed_plan_email_v1',
    subject: 'Your MORE plan is set',
    plan_text: planText,
    text: `${opening}\n\n${planText}\n\n${closing}`,
    html: `<!doctype html><html><body style="margin:0;background:#eef4f1;font-family:Arial,sans-serif;color:#13211d;"><main style="max-width:680px;margin:0 auto;padding:36px 20px;"><section style="padding:30px;border-radius:18px;background:#ffffff;"><div style="font-size:13px;font-weight:800;letter-spacing:.12em;color:#176b55;">MORE</div><h1 style="margin:18px 0 12px;font-size:30px;line-height:1.15;">${escapeHtml(opening)}</h1><p style="font-size:16px;line-height:1.55;color:#4c5d57;">${escapeHtml(clean(plan.summary, 700))}</p><h2 style="margin:30px 0 8px;font-size:22px;">${escapeHtml(clean(plan.title, 160))}</h2><p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#176b55;">Agreed next steps</p><ol style="margin:0;padding:0;list-style:none;">${commitments}</ol>${unresolved}<p style="margin:28px 0 0;font-size:15px;line-height:1.55;color:#4c5d57;">${escapeHtml(closing)}</p></section></main></body></html>`,
  });
}

export const CONSULTING_AGREEMENT_EMAIL_CONTRACT = Object.freeze({
  subject: 'Your MORE plan is set',
  customer_language: 'consulting',
  accepted_snapshot_only: true,
});
