import React, {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import BusinessTwinApp from './BusinessTwinApp.jsx';
import ReportPage from './ReportPage.jsx';
import {project} from './projection.js';
import './base.css';
import './athlete.css';
import './youth.css';
import {api} from '../transport.js';

// The approved report lives in its own document so the consulting shell cannot
// restyle its typography, five-box layout, responsive rules or evidence drawers.
export default function ApprovedApa(){
  const [slug]=useState(()=>new URLSearchParams(location.search).get('athlete'));
  const [boundary]=useState(()=>{
    try { if(window.parent===window||window.parent.location.pathname!=='/athlete-consulting-tool/demo/workspace.html')return 'Open this reading inside the consulting tool.'; }
    catch { return 'Open this reading inside the consulting tool.'; }
    return ['nia','sofia'].includes(slug)?'':'Choose an athlete from the consulting tool.';
  });
  const [bundle,setBundle]=useState(null),[error,setError]=useState(boundary);
  useEffect(()=>{
    if(boundary)return;
    let alive=true;
    api('bundle/'+slug).then(value=>{if(alive)setBundle(value);}).catch(e=>{if(alive)setError(e.message);});
    return()=>{alive=false;};
  },[boundary,slug]);
  if(!bundle)return <main className="apa-gallery"><p role={error?'alert':'status'}>{error||'Opening your saved APA…'}</p></main>;
  const a=bundle.apa;
  return <div className="athlete-apa-parity-root apa-v2"><BusinessTwinApp key={a.artifact_sha256} viewModel={project(a)} pageComponent={ReportPage} pageProps={{a}}/></div>;
}
createRoot(document.getElementById('root')).render(<ApprovedApa/>);
