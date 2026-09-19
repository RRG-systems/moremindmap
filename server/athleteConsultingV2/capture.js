import { createHash } from 'node:crypto';
import { applyLocalAction, requireThat } from './state.js';
const digest = x => createHash('sha256').update(x).digest('hex');
export function applyCapture(state, body, bundle) {
  if (body.action !== 'capture_demo') return applyLocalAction(state, body, bundle);
  const c = body.capture;
  requireThat(bundle.person.synthetic === true && c && c.subject === bundle.person.slug, 'CAPTURE_SUBJECT_DENIED');
  requireThat(['athlete','coach'].includes(c.role) && c.source === (c.role === 'coach' ? 'Coach Alex (synthetic)' : bundle.person.name + ' (synthetic)'), 'CAPTURE_SOURCE_DENIED');
  requireThat(typeof c.text === 'string' && c.text.trim().length > 0 && c.text.length <= 4000, 'CAPTURE_TEXT_REQUIRED');
  requireThat(['text','voice','photo'].includes(c.kind), 'CAPTURE_KIND_INVALID');
  requireThat(Array.isArray(c.attachments) && c.attachments.length <= 2, 'CAPTURE_MEDIA_INVALID');
  for (const a of c.attachments) {
    requireThat(a && typeof a.data === 'string' && /^(image\/(jpeg|png|webp)|audio\/(mp4|mpeg|webm|wav|x-wav|m4a))$/.test(a.mime), 'CAPTURE_MEDIA_INVALID');
    requireThat(/^[A-Za-z0-9+/]*={0,2}$/.test(a.data) && a.data.length > 0 && a.data.length <= 1400000, 'CAPTURE_MEDIA_TOO_LARGE');
    const bytes = Buffer.from(a.data, 'base64');
    const valid = a.mime === 'image/png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : a.mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : a.mime === 'image/webp' ? bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP'
      : a.mime.includes('wav') ? bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WAVE'
      : a.mime === 'audio/webm' ? bytes.subarray(0,4).toString('hex')==='1a45dfa3'
      : a.mime === 'audio/mpeg' ? bytes.toString('ascii',0,3)==='ID3' || (bytes[0]===255 && (bytes[1]&224)===224)
      : bytes.toString('ascii',4,8)==='ftyp';
    requireThat(valid, 'CAPTURE_MEDIA_INVALID');
  }
  requireThat(c.kind !== 'photo' || c.attachments.some(a => a.mime.startsWith('image/')), 'PHOTO_REQUIRED');
  requireThat(c.kind !== 'voice' || c.attachments.some(a => a.mime.startsWith('audio/')), 'VOICE_REQUIRED');
  const at = new Date().toISOString();
  const attachments = c.attachments.map(a => ({mime:a.mime,data:a.data,sha256:digest(Buffer.from(a.data,'base64'))}));
  const capture = { contract:'athlete_capture_demo_v1', subject:c.subject, source:c.source, role:c.role, kind:c.kind, at,
    interpretation:'Unverified source observation; no assessment, learning or plan approval.',
    transcript_status:attachments.some(a=>a.mime.startsWith('audio/'))?'user_reviewed_text':'not_applicable', transcription:c.transcription||null, attachments };
  state.messages.push({id:body.requestId,role:'user',speaker:c.role,text:`[DEMO ${c.kind.toUpperCase()} OBSERVATION · ${c.source} · ${at}]\n${c.text.trim()}\nUnverified observation. No BOS, APA or plan change approved.`,at,capture});
  state.events.push({type:'demo_capture_received',id:body.requestId,subject:c.subject,source:c.source,at,media_hashes:attachments.map(a=>a.sha256)});
}
export function captureSummaries(state) {
  return state.messages.filter(m=>m.capture).map(m=>({id:m.id,text:m.text,at:m.at,...m.capture,attachments:m.capture.attachments.map(({data:_data,...a})=>a)}));
}

// Hosted capture remains inside the existing synthetic Leadership capability.
// Reserve most of the existing state envelope for future Consulting sessions.
export function applyLiveCapture(state, body, bundle) {
  if (body.action !== 'capture_demo') return applyLocalAction(state, body, bundle);
  const c = body.capture;
  requireThat(c?.reviewed === true, 'CAPTURE_REVIEW_REQUIRED');
  requireThat(Array.isArray(c.attachments), 'CAPTURE_MEDIA_INVALID');
  const bytes = c.attachments.reduce((n,a) => n + (typeof a?.data === 'string' ? a.data.length : 9999999), 0);
  requireThat(bytes <= 360000, 'CAPTURE_MEDIA_TOO_LARGE');
  const saved = state.messages.reduce((n,m) => n + (m.capture?.attachments || []).reduce((v,a) => v + (a.data?.length || 0), 0), 0);
  requireThat(saved + bytes <= 1000000, 'CAPTURE_DEMO_MEDIA_FULL');
  // Only approved fields enter durable provenance; client metadata is not authority.
  applyCapture(state, {...body, capture:{subject:c.subject, source:c.source, role:c.role, kind:c.kind,
    text:c.text, attachments:c.attachments}}, bundle);
  state.messages.at(-1).capture.bridge = 'darren_demo_same_scope_v1';
}

export function captureContextMessage(message) {
  if (!message.capture) return message;
  return {...message, capture:{...message.capture,
    media_interpretation:'Attachments are preserved for human review. No image or audio analysis has been performed. Use the reviewed source text only.',
    attachments:message.capture.attachments.map(({data:_data,...metadata}) => metadata)}};
}
