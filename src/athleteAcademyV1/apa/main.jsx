import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import BusinessTwinApp from './BusinessTwinApp.jsx';
import ReportPage from './ReportPage.jsx';
import {project} from './projection.js';
import {call,workspaceLink} from '../transport.js';
import {api} from '../coach/transport.js';
import {APA_BOXES,continuityView,apaReadingLabel} from '../coach/currentApaUi.js';
import ClientSessionBoundary from '../ClientSessionBoundary.jsx';
import './base.css';import './athlete.css';import './youth.css';

function App(){
 const [mm]=useState(()=>new URLSearchParams(location.search).get('mm'));
 const [embedded]=useState(()=>{
  try{return window.parent!==window&&window.parent.location.origin===location.origin
   &&window.parent.location.pathname==='/athlete/workspace/coach.html'
   &&new URLSearchParams(window.parent.location.search).get('mm')===mm;}
  catch{return false;}
 });
 const [loaded,setLoaded]=useState(null),[error,setError]=useState(''),[refreshing,setRefreshing]=useState(false);
 const [reading,setReading]=useState(()=>{
  const value=new URLSearchParams(location.search).get('reading');
  return ['current','original','preview'].includes(value)?value:'current';
 });
 const request=useRef(0),minimum=useRef(0),revision=useRef(-1);
 const reload=useCallback(async(nextMinimum=minimum.current)=>{
  const id=++request.current;minimum.current=Math.max(minimum.current,nextMinimum);setRefreshing(true);
  try{
   let result;
   if(embedded){
    const [bundle,state]=await Promise.all([api('bundle/'+mm),api('state/'+mm)]);
    if(!Number.isSafeInteger(state.revision)||state.revision<minimum.current||state.revision<revision.current)
     throw Error('The latest saved view is still updating. Refresh this reading before deciding.');
    const view=continuityView(bundle,state,{reading});
    if(view.enabled&&!view.verified)throw Error(view.error);
    result={bundle,state};
   }else{
    const saved=await call('get_report',{service:'apa',mm});
    result={artifact:saved.artifact,stale:saved.stale};
   }
   if(id!==request.current)return;
   if(result.state)revision.current=result.state.revision;
   setLoaded(result);setError('');setRefreshing(false);
  }catch(cause){if(id===request.current){setError(cause.message||'This APA reading is unavailable.');setRefreshing(false);}}
 },[embedded,mm,reading]);
 useEffect(()=>{const counter=request;reload();return()=>{counter.current++;};},[reload]);
 useEffect(()=>{
  if(!embedded)return;
  const receive=event=>{
   const d=event?.data;
   if(event.origin!==location.origin||event.source!==window.parent||d?.contract!=='athlete-academy-apa-refresh'
    ||d.mm!==mm||!Number.isSafeInteger(d.revision)||d.revision<0
    ||!['current','original','preview'].includes(d.reading))return;
   setReading(d.reading);
   if(d.revision>revision.current)reload(d.revision);
  };
  window.addEventListener('message',receive);
  window.parent.postMessage({contract:'athlete-academy-apa-ready',mm},location.origin);
  return()=>window.removeEventListener('message',receive);
 },[embedded,mm,reload]);
 const selected=loaded?.bundle?continuityView(loaded.bundle,loaded.state,{reading}):null;
 const stale=Boolean(error)||(refreshing&&minimum.current>revision.current)||Boolean(selected?.stale||loaded?.stale);
 const shareBox=useCallback(({destination,objectId=null})=>{
  if(!embedded||stale||!selected?.verified||!APA_BOXES.includes(destination))return;
  const visibleReading=selected.showOriginal?'original':selected.showPreview?'preview':selected.needsReview?'historical':'current';
  window.parent.postMessage({contract:'athlete-academy-apa-context',mm,revision:loaded.state.revision,
   reading:visibleReading,box:destination,objectId,version:selected.version,
   artifact_hash:selected.artifact.artifact_sha256},location.origin);
  if(selected.showPreview)window.parent.postMessage({contract:'athlete-academy-apa-box',mm,reading:'preview',box:destination,
   draft_id:selected.draft.id,artifact_hash:selected.artifact.artifact_sha256},location.origin);
 },[embedded,loaded?.state?.revision,mm,selected,stale]);
 if(!loaded)return <main className="apa-gallery"><h1>{error||'Opening your APA…'}</h1>
  {error&&<button type="button" onClick={()=>reload()}>Refresh saved APA</button>}
  <a target="_top" href="/athlete/workspace/index.html#home">← Your Athlete home</a></main>;
 const a=selected?.artifact||loaded.artifact;
 const options=selected?{acceptedPlan:selected.acceptedPlan,version:selected.version,receipt:selected.receipt,
  showOriginal:selected.showOriginal,showPreview:selected.showPreview,needsReview:selected.needsReview,stale}:{showOriginal:true,stale};
 const label=selected?apaReadingLabel({...selected,stale}):stale?'Saved APA · earlier source or currency unconfirmed':'Original saved APA';
 return <div className="athlete-apa-parity-root apa-v2">
  <header className="apa-review-bar"><a target="_top" href="/athlete/workspace/index.html#home">← Your Athlete home</a>
   <span>{a.identity.name} · {a.mm}</span><a target="_top" href="/athlete/workspace/index.html#apa">Review my original answers ↗</a>
   <a target="_top" href={workspaceLink('bos',a.mm)}>Your BOS →</a></header>
  <div className="apa-review-bar" role={stale?'alert':'status'}>{label}</div>
  {stale&&<section className="panel"><p>{error||'The saved reading remains available, but its currency is not confirmed. Do not treat it as the latest APA.'}</p>
   {loaded.stale&&<p>This APA uses an earlier BOS. <a target="_top" href="/athlete/workspace/index.html#apa">Update your APA with your latest profile →</a></p>}
   <button type="button" disabled={refreshing} onClick={()=>reload()}>Refresh saved APA</button></section>}
  {selected?.verified&&<section className="panel" aria-label="Choose APA reading"><p>Your original assessment and evidence remain preserved. Your agreed plan is separate.</p>
   <div className="actions">{['current','original',...(selected.draft?['preview']:[])].map(value=><button type="button" key={value}
    aria-pressed={reading===value} onClick={()=>setReading(value)}>{value==='preview'?'Proposed APA · not current':value==='original'?'Original saved APA':selected.needsReview?'Previous reading · review needed':'Saved current reading'}</button>)}</div></section>}
  <BusinessTwinApp key={a.artifact_sha256} onContextChange={shareBox} viewModel={project(a,options)}
   pageComponent={ReportPage} pageProps={{a,...options}}/>
 </div>;
}
createRoot(document.getElementById('root')).render(<ClientSessionBoundary><App/></ClientSessionBoundary>);
export {App};
