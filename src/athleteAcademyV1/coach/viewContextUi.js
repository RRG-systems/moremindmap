import { continuityView } from './currentApaUi.js';
const BOXES = new Set(['where','futures','move','plan','evidence']);
const OBJECTS = new Set(['domain-sport','domain-training','domain-mindset','domain-school',
  'future-current_course','future-emerging_future','future-better_future','future-bold_future',
  'future-downside_future','move','connection','sources','agreement','version']);
const READINGS = new Set(['current','original','preview','historical','unverified']);
export function frameViewContext(event,{origin,frame,bundle,state}) {
  const d = event?.data;
  if (event.origin!==origin||event.source!==frame||d?.contract!=='athlete-academy-apa-context'
    ||d.mm!==bundle.person.mm||d.revision!==state.revision||!BOXES.has(d.box)
    ||!READINGS.has(d.reading)||!(d.objectId===null||OBJECTS.has(d.objectId))) return null;
  const view = continuityView(bundle,state,{reading:d.reading});
  if (!view.verified||view.stale||d.artifact_hash!==view.artifact.artifact_sha256
    ||d.version!==view.version||d.reading==='historical'&&!view.needsReview
    ||d.reading==='current'&&view.needsReview) return null;
  return {section:d.box,reading:d.reading,...(d.objectId?{objectId:d.objectId}:{})};
}
