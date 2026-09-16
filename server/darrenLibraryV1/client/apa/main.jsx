import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import BusinessTwinApp from './BusinessTwinApp.jsx';
import ReportPage from './ReportPage.jsx';
import {project} from './projection.js';
import './base.css';import './athlete.css';import './youth.css';
function App(){
 const [a,setA]=useState(null),[error,setError]=useState('');
 useEffect(()=>{fetch('/darren-library/api/report/apa/'+new URLSearchParams(location.search).get('athlete')).then(async r=>{if(!r.ok)throw Error('This saved APA could not be opened.');return r.json();}).then(d=>{setA(d.artifact);document.title=`MORE · ${d.artifact.identity.name}’s Youth APA`;}).catch(e=>setError(e.message));},[]);
 if(!a)return <main className="apa-gallery"><p>{error||'Opening your saved APA…'}</p><a href="/darren-library/library#apa">Back to the library</a></main>;
 return <div className="athlete-apa-parity-root apa-v2"><header className="apa-review-bar"><a href="/darren-library/library#apa" style={{color:'var(--green)',padding:'.7rem',textDecoration:'none'}}>← All athlete reports</a><span>{a.identity.name} · {a.mm}</span><a href={'/darren-library/bos.html?athlete='+new URLSearchParams(location.search).get('athlete')} style={{color:'var(--green)',padding:'.7rem'}}>Open their BOS →</a></header><BusinessTwinApp viewModel={project(a)} pageComponent={ReportPage} pageProps={{a}}/></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
export { App };
