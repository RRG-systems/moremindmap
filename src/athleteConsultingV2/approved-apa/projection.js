import {DOMAINS,ROLES,ROLE_LABELS,dateLabel} from './design.js';
const CURRENT_CONTRACT='athlete_current_apa_v1';
const APA_BOXES=new Set(['where','futures','move','plan','evidence']);
const APA_READINGS=new Set(['current','original','preview','historical','unverified']);
const APA_OBJECT_IDS=new Set(['move','connection','sources','agreement','version',
 ...DOMAINS.map(domain=>`domain-${domain.id}`),...ROLES.map(role=>`future-${role}`)]);
const fail=()=>{throw Error('The latest APA version could not be verified. Reload this reading.');};
export function apaBoxContextMessage(slug,destination,{reading='current',objectId=null}={}){
 if(!['nia','sofia'].includes(slug)||!APA_READINGS.has(reading)
  ||!(destination==='overview'||APA_BOXES.has(destination))
  ||!(objectId===null||APA_OBJECT_IDS.has(objectId)))return null;
 return {contract:'athlete-v2-apa-box-context',slug,
  box:destination==='overview'?null:destination,reading,objectId};
}
export function requestedApaReading(event,{origin,parent,slug}){
 const data=event?.data;
 return event?.origin===origin&&event?.source===parent
  &&data?.contract==='athlete-v2-select-apa-reading'&&data.slug===slug
  &&['current','original','preview'].includes(data.reading)?data.reading:null;
}
function verifyRecord(record,bundle){
 if(record==null)return;
 const baseline=bundle.apa,a=record.artifact,last=record.receipts?.at(-1);
 if(record.contract!==CURRENT_CONTRACT||!Number.isSafeInteger(record.version)||record.version<1
  ||record.version!==record.receipts?.length||record.binding?.slug!==bundle.person.slug
  ||record.binding?.mm!==bundle.person.mm||record.binding?.baseline_hash!==baseline.artifact_sha256
  ||record.binding?.bos_hash!==bundle.bos?.artifact_sha256||a?.mm!==bundle.person.mm
  ||a?.baseline_artifact_sha256!==baseline.artifact_sha256||a?.bos_sha256!==bundle.bos?.artifact_sha256
  ||a?.current_apa_version!==record.version||last?.content_hash!==a?.artifact_sha256)fail();
}
export function resolveApaReading(bundle,state,{showOriginal=false,showPreview=false}={}){
 if(!bundle?.apa||!bundle?.person||!state||!Number.isSafeInteger(state.revision)||state.mm!==bundle.person.mm)fail();
 const baseline=bundle.apa,record=state.currentApa;
 verifyRecord(record,bundle);
 const draft=state.apaDraft||null,preview=draft?.previewRecord||null;
 if(draft){
  verifyRecord(preview,bundle);
  if(!preview||draft.expectedVersion!==(record?.version||0)
   ||preview.version!==(record?.version||0)+1
   ||draft.receipt?.receipt_hash!==undefined&&draft.receipt.receipt_hash!==preview.receipts.at(-1)?.receipt_hash
   ||record&&preview.receipts.at(-2)?.receipt_hash!==record.receipts.at(-1)?.receipt_hash
   ||draft.confirmedChange?.mm!==bundle.person.mm
   ||draft.confirmedChange?.athlete_slug!==bundle.person.slug)fail();
 }
 const current=record?.artifact||baseline;
 const selectedPreview=Boolean(showPreview&&preview&&!showOriginal);
 const selectedOriginal=Boolean(showOriginal&&(record||preview));
 const selected=selectedPreview?preview:record;
 return {artifact:selectedOriginal?baseline:selectedPreview?preview.artifact:current,
  baseline,current,preview:preview?.artifact||null,availableCurrentVersion:record?.version||0,
  version:selected?.version||0,receipt:selected?.receipts?.at(-1)||null,
  acceptedPlan:state.plan||null,showOriginal:selectedOriginal,showPreview:selectedPreview,
  needsReview:state.apaNeedsReview===true};
}
export function shouldRefreshApa(event,{origin,parent,slug,currentRevision}){
 const data=event?.data;
 return event?.origin===origin&&event?.source===parent&&data?.contract==='athlete-v2-current-apa'
  &&data.slug===slug&&Number.isSafeInteger(data.revision)&&data.revision>=0
  &&data.revision>currentRevision;
}
export function project(a,{version=0,receipt=null,acceptedPlan=null,showOriginal=false,showPreview=false,needsReview=false}={}){
 const objects={},r=a.report,m=a.move;
 const superseded=new Set(a.sources.flatMap(s=>s.supersedes||[]));
 const sourceText=s=>s.id==='CONFIRM'?DOMAINS.map(d=>`${d.label}: ${a.confirmation.goals[d.id]}`).join(' ') + ` Your chosen priority: ${a.confirmation.priority} Review your move on ${dateLabel(a.confirmation.review_date)}; look ahead to ${dateLabel(a.confirmation.horizon_date)}.`:s.text;
 const sourceLine=s=>`${s.source}${s.question?` · ${s.question}`:''}${s.supersedes?.length?' · Correction of an earlier saved statement':''}${superseded.has(s.id)?' · Superseded by a later athlete correction':''}: ${sourceText(s)}`;
 const section=(title,items)=>({id:title.toLowerCase().replace(/[^a-z]+/g,'-'),title,items:Array.isArray(items)?items:[items]});
 const sourceSections=x=>[section('Your current answers',(x.refs||[]).map(id=>{const s=a.sources.find(s=>s.id===id);return s?sourceLine(s):id;})),section('Your saved BOS',(x.bos_refs||[]).map(id=>{const b=a.bos_sources.find(b=>b.id===id);return `${b.headline}: ${b.text}`;}))].filter(s=>s.items.length);
 const obj=(id,destination,title,items,kind='MORE interpretation')=>{objects[id]={object_id:id,destination,drawer_type:'apa-v2',display_payload:{title},epistemic_class:kind,confidence:null,drawer_payload:items};};
 for(const d of r.domains)obj(`domain-${d.id}`,'where',DOMAINS.find(x=>x.id===d.id).label,[section('What MORE sees',d.detail),section('How your BOS helps',d.bos_connection),...(d.unknowns.length?[section('Still to understand',d.unknowns)]:[]),...sourceSections(d)]);
 for(const f of r.futures)obj(`future-${f.role}`,'futures',f.headline,[section('Why this path is possible',f.details),...sourceSections(f)],'Conditional possibility');
 if(m)obj('move','move','Why this move fits you',[section('Your personality matters',m.bos_fit),section('Why this first',m.why),section('Other options we considered',r.candidates.filter(c=>c.candidate_id!==m.candidate_id).map(c=>c.gates.every(g=>g.pass)?`Possible alternative: ${c.action} ${c.why}`:`Not recommended this week: ${c.action} ${c.gates.filter(g=>!g.pass).map(g=>g.reason).join(' ')}`)),section('Fits your real week',m.gates.map(g=>g.reason)),...sourceSections(m)],'Suggestion to discuss');
 obj('connection','where','How the four parts connect',[section('The whole picture',r.connection),section('Your chosen priority',a.confirmation.priority),section('What may be getting in the way',r.main_obstacle),section('Still to understand',r.what_we_dont_know.length?r.what_we_dont_know:['No other major gap was identified in these answers.'])]);
 obj('sources','evidence','Your sources',[section('Your APA',a.sources.map(sourceLine)),section('Your BOS',a.bos_sources.map(s=>`${s.headline}: ${sourceText(s)}`))],'Your saved words and BOS');
 if(acceptedPlan)obj('agreement','plan','Your accepted plan',[section('Why this matters',acceptedPlan.why||'Chosen by the athlete.'),section('Agreed steps',(acceptedPlan.steps||[]).map(step=>`${step.owner==='coach'?'Coach':'Athlete'}: ${step.action} ${step.when||''} ${step.notice||''}`)),section('Check-in',acceptedPlan.review||'To be agreed')],'Confirmed agreement');
 if(version>0&&receipt)obj('version','evidence',showPreview?`Proposed APA · version ${version} · not current`:showOriginal?'Original APA and saved version':needsReview?`Previous APA · version ${version} · review needed`:`Current APA · version ${version}`,[section('What changed',receipt.reason),section('Confirmed on',receipt.at),section('Original remains saved',a.baseline_artifact_sha256||a.artifact_sha256),...(showPreview?[section('Publication status','Proposed update only. Your current APA has not changed.')]:needsReview?[section('Review status','This earlier APA is historical until the athlete reviews and publishes an updated reading.')]:[])],showPreview?'Unpublished athlete-review proposal':needsReview?'Historical athlete reading awaiting review':'Versioned athlete-confirmed reading');
 const nav=[{id:'where',label:'Where you are',order:1},{id:'futures',label:'Five Futures',order:2},{id:'move',label:'One Move',order:3},{id:'plan',label:'Your plan',order:4},{id:'evidence',label:'Why MORE says this',order:5}];
 return {identity:{firstName:a.identity.name.split(' ')[0],vertical:a.identity.sport},stateHash:a.artifact_sha256,nav,objects,destinations:Object.fromEntries(nav.map(n=>[n.id,{}])),hero:{eyebrow:'YOUR ATHLETE PERFORMANCE ASSESSMENT',title:`${a.identity.name.split(' ')[0]}, this is your next chapter.`,subtitle:r.opening,modelDate:`${dateLabel(a.confirmation.assessment_date)}, ${a.confirmation.assessment_date.slice(0,4)} · ${a.mm}`},presentation:{explanationEyebrow:'YOUR APA',brandAria:'MORE Athlete',brandTop:'MORE',brandBottom:'ATHLETE',railKicker:'Your performance assessment',navAria:'Your APA',boundaryTitle:'Your saved assessment',boundaryCopy:'Your answers today, connected to your saved personality profile (BOS).' ,backLabel:'← Back to your APA',overviewAria:'Your APA boxes',bigPictureLabel:'The whole picture',bigPictureAria:'How the four parts of your life connect',nextStepLabel:'Your chosen priority',startPlanLabel:'See your next step',snapshotTitle:'Your voice comes first.',snapshotCopy:'This is a suggestion to discuss. You choose what to try.',drawerSuffix:'Why MORE says this',drawerFooter:'Your answers and your saved BOS. Suggestions can be corrected.',howCopy:'Your BOS is your saved personality profile. This APA connects that whole person to your sport and life now. Start with Where you are: Sport, Training, Warrior Mindset, and School. Five Futures shows what could happen under different conditions. One Move suggests one useful next step. Open Why MORE says this whenever you want the reasoning. You can review and correct your answers from the top bar.',returnLabel:'Return to your APA'},layer0:{cards:[
 {id:'where',objectId:'connection',title:'Where you are',description:'Four parts of your life. One clear picture.',value:'4',qualifier:'Goals that belong to you',details:DOMAINS.map(d=>({value:d.label,label:a.confirmation.goals[d.id]})),cta:'See your four areas'},
 {id:'futures',objectId:'connection',title:'Five Futures',description:`Five possible paths to ${dateLabel(a.confirmation.horizon_date)}.`,items:r.futures.map((f,i)=>({label:f.headline,displayValue:ROLE_LABELS[i]})),cta:'Explore the paths'},
 {id:'move',objectId:'move',title:'One Move',description:'One useful thing to do next.',icon:'⌾',value:m?.action||'Clarify what fits first.',qualifier:'Chosen to fit your goals, your personality, and your week.',cta:'See your move'},
 {id:'plan',objectId:acceptedPlan?'agreement':'move',title:'Your plan',description:'Keep the next step simple.',icon:'✓',value:acceptedPlan?.title||'Try. Notice. Review.',qualifier:acceptedPlan?'Your agreed plan. The APA suggestion is separate.':m?.review_schedule?`Setup check on ${dateLabel(a.confirmation.review_date)}. Check usefulness after the agreed test.`:`A proposal for you to consider. Review on ${dateLabel(a.confirmation.review_date)}.`,cta:acceptedPlan?'See your agreement':'See the proposal'},
  {id:'evidence',objectId:'sources',title:'Why MORE says this',description:'Your words. Your personality. The reasoning.',icon:'▤',items:[{value:'20',label:'Original APA answers'},{value:'4',label:'Goals you confirmed'},{value:'BOS',label:'Your whole-person profile'}],cta:'See the reasons'}
 ],bigPicture:r.headline,bigPictureQualifier:r.connection,nextStep:a.confirmation.priority,nextStepQualifier:'One practical next step, with room for the rest of your life.'}};
}
