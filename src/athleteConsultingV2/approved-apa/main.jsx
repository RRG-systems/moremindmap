import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import BusinessTwinApp from './BusinessTwinApp.jsx';
import ReportPage from './ReportPage.jsx';
import {apaBoxContextMessage,project,requestedApaReading,resolveApaReading,shouldRefreshApa} from './projection.js';
import './base.css';
import './athlete.css';
import './youth.css';
import {api} from '../transport.js';

// The protected report keeps its five-box styling. The bundle supplies the
// immutable original; authenticated same-athlete state supplies the current APA.
export default function ApprovedApa(){
 const [slug]=useState(()=>new URLSearchParams(location.search).get('athlete'));
 const [boundary]=useState(()=>{
  try{if(window.parent===window||window.parent.location.pathname!=='/athlete-consulting-tool/demo/workspace.html')return 'Open this reading inside the consulting tool.';}
  catch{return 'Open this reading inside the consulting tool.';}
  return ['nia','sofia'].includes(slug)?'':'Choose an athlete from the consulting tool.';
 });
 const [loaded,setLoaded]=useState(null),[error,setError]=useState(boundary),[refreshing,setRefreshing]=useState(false),[readingChoice,setReadingChoice]=useState(()=>{
  const choice=new URLSearchParams(location.search).get('reading');
  return ['current','original','preview'].includes(choice)?choice:'current';
 });
 const bundleRef=useRef(null),revisionRef=useRef(-1),minimumRef=useRef(0),requestRef=useRef(0);
 const reload=useCallback(async(minimum=minimumRef.current)=>{
  if(boundary)return;
  minimumRef.current=Math.max(minimumRef.current,minimum);
  const request=++requestRef.current;
  setRefreshing(true);
  try{
   const [bundle,state]=await Promise.all([
    bundleRef.current?Promise.resolve(bundleRef.current):api('bundle/'+slug),api('state/'+slug),
   ]);
   if(!Number.isSafeInteger(state?.revision)||state.revision<minimumRef.current||state.revision<revisionRef.current)
    throw Error('The latest APA is still updating. Please retry.');
   resolveApaReading(bundle,state);
   if(request!==requestRef.current)return;
   bundleRef.current=bundle;revisionRef.current=state.revision;
   setLoaded({bundle,state});setError('');setRefreshing(false);
  }catch(cause){if(request===requestRef.current){setError(cause.message||'The latest APA is unavailable.');setRefreshing(false);}}
 },[boundary,slug]);
 useEffect(()=>{
  if(boundary)return;
  const requests=requestRef;
  reload();
  return()=>{requests.current++;};
 },[boundary,reload]);
 useEffect(()=>{
  if(boundary)return;
  const receive=event=>{
   const requested=requestedApaReading(event,{origin:location.origin,parent:window.parent,slug});
   if(requested)setReadingChoice(requested);
   if(shouldRefreshApa(event,{origin:location.origin,parent:window.parent,slug,
    currentRevision:revisionRef.current}))reload(event.data.revision);
  };
  window.addEventListener('message',receive);
  window.parent.postMessage({contract:'athlete-v2-apa-ready',slug},location.origin);
  return()=>window.removeEventListener('message',receive);
 },[boundary,reload,slug]);
 const currencyUnverified=Boolean(error)||(refreshing&&minimumRef.current>revisionRef.current);
 const reportedReading=currencyUnverified?'unverified':readingChoice==='original'?'original'
  :readingChoice==='preview'&&loaded?.state?.apaDraft?'preview'
   :loaded?.state?.apaNeedsReview?'historical':'current';
 const shareBox=useCallback(({destination,drawerObjectId})=>{
  if(boundary||window.parent===window)return;
  const message=apaBoxContextMessage(slug,destination,{reading:reportedReading,objectId:drawerObjectId});
  if(message)window.parent.postMessage(message,location.origin);
 },[boundary,reportedReading,slug]);
 if(boundary)return <main className="apa-gallery"><p role="alert">{boundary}</p></main>;
 if(error&&!loaded)return <main className="apa-gallery"><p role="alert">{error}</p><button type="button" onClick={()=>reload()}>Retry current APA</button></main>;
 if(!loaded)return <main className="apa-gallery"><p role="status">Opening the latest APA…</p></main>;
 const reading=resolveApaReading(loaded.bundle,loaded.state,{
  showOriginal:readingChoice==='original',showPreview:readingChoice==='preview'});
 const a=reading.artifact;
 const stale=currencyUnverified;
 const currencyLabel=stale?'LAST VERIFIED APA · CURRENCY UNCONFIRMED'
  :reading.showPreview?'PROPOSED UPDATE · NOT CURRENT'
   :reading.showOriginal?'ORIGINAL SAVED APA'
    :reading.needsReview?'PREVIOUS APA · REVIEW NEEDED'
     :reading.availableCurrentVersion>0?`CURRENT APA · VERSION ${reading.availableCurrentVersion}`:'CURRENT APA · ORIGINAL READING';
 return <div className="athlete-apa-parity-root apa-v2">
  <div className={`apa-currency-strip${stale?' apa-currency-stale':''}`} role={stale?'alert':'status'}>{currencyLabel}</div>
  {stale&&<div className="apa-refresh-failure" role="alert"><p>The last verified reading remains available, but its currency cannot be confirmed. Do not treat it as the latest APA until refresh succeeds.</p><button type="button" onClick={()=>reload()} disabled={refreshing}>{refreshing?'Retrying…':'Retry latest APA'}</button></div>}
  {refreshing&&<p role="status" className="apa-note">Refreshing the current APA…</p>}
  {(reading.availableCurrentVersion>0||reading.preview||reading.needsReview)&&<section className="panel apa-connection" aria-label="APA reading version">
   <p className="eyebrow green">{reading.showPreview?`PROPOSED UPDATE · VERSION ${reading.version} · NOT CURRENT`:reading.showOriginal?'ORIGINAL SAVED APA':reading.needsReview?'PREVIOUS APA · REVIEW NEEDED':reading.availableCurrentVersion>0?`CURRENT APA · VERSION ${reading.availableCurrentVersion}`:'CURRENT APA · ORIGINAL READING'}</p>
   <p>{reading.showPreview?'This is a proposed update for your review. It is not your current APA and has not been published. Your accepted plan is separate.':reading.showOriginal?'This is the preserved original assessment. The saved reading remains available beside it.':reading.needsReview?'A correction or retraction has changed the evidence. This earlier APA is historical until the athlete reviews and publishes an updated reading.':reading.availableCurrentVersion>0?`Updated from an athlete-confirmed change. ${reading.receipt.reason} The original assessment remains saved.`:'Your original assessment is still the current APA. A proposed update is available for review but has not been published.'}</p>
   <div className="actions" role="group" aria-label="Choose APA reading">
    <button type="button" aria-pressed={!reading.showOriginal&&!reading.showPreview} onClick={()=>setReadingChoice('current')}>{reading.needsReview?'Previous reading · review needed':'Current reading'}</button>
    <button type="button" aria-pressed={reading.showOriginal} onClick={()=>setReadingChoice('original')}>Original saved APA</button>
    {reading.preview&&<button type="button" aria-pressed={reading.showPreview} onClick={()=>setReadingChoice('preview')}>Proposed update · not current</button>}
   </div>
  </section>}
  <BusinessTwinApp key={slug} onContextChange={shareBox} viewModel={project(a,{version:reading.version,receipt:reading.receipt,
   acceptedPlan:reading.acceptedPlan,showOriginal:reading.showOriginal,showPreview:reading.showPreview,
   needsReview:reading.needsReview})} pageComponent={ReportPage}
   pageProps={{a,acceptedPlan:reading.acceptedPlan,version:reading.version,
    receipt:reading.receipt,showOriginal:reading.showOriginal,showPreview:reading.showPreview,
    needsReview:reading.needsReview,stale}}/>
 </div>;
}
createRoot(document.getElementById('root')).render(<ApprovedApa/>);
