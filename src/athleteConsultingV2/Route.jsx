import React, {useEffect,useRef,useState} from 'react';
import LegacyAthlete from '../athleteLivingConsultOneShotV1/App.jsx';
export default function AthleteConsultingRoute() {
  const [version,setVersion]=useState(null),[error,setError]=useState(false),frame=useRef();
  const [initial]=useState(()=>`/athlete-consulting-tool/demo/workspace.html${location.search}${location.hash}`);
  useEffect(()=>{let active=true;fetch('/api/internal/athlete-living-consult-one-shot-v1?version_only=1',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(x=>{if(active)setVersion(x.version);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[]);
  useEffect(()=>{const update=e=>{if(e.origin!==location.origin||e.source!==frame.current?.contentWindow||e.data?.contract!=='athlete-v2-navigation'||!['nia','sofia'].includes(e.data.slug)||!['home','you','sport','plan'].includes(e.data.view))return;history.replaceState(null,'',`?athlete=${e.data.slug}#${e.data.view}`);};window.addEventListener('message',update);return()=>window.removeEventListener('message',update);},[]);
  if(error)return <main><p>The Athlete demo is unavailable.</p><a href="/leadership">Return to Leadership</a></main>;
  if(version===1)return <LegacyAthlete/>;
  if(version!==2)return <p role="status">Opening Athlete Consulting…</p>;
  return <iframe ref={frame} title="MORE Athlete Consulting" src={initial} style={{position:'fixed',inset:0,width:'100%',height:'100dvh',border:0,background:'#050b0a'}}/>;
}
