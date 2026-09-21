import React, { useEffect, useRef, useState } from 'react';
import { VECTORS, CHAPTERS, QUESTIONS } from './design.js';
import './style.css';
import {call} from '../transport.js';


const COLORS = ['#f4b860', '#f07f5a', '#e75d81', '#ac70da', '#7287e8', '#43a7c2', '#48b58e', '#a9bd55'];
const point = (i, r) => ({ x: 260 + Math.cos(i * Math.PI / 4 - Math.PI / 2) * r, y: 260 + Math.sin(i * Math.PI / 4 - Math.PI / 2) * r });
const region = position => ['Usually left', 'Leans left', 'Changes with context', 'Leans right', 'Usually right'][position] || 'Still open';

function Dialog({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => { const node = ref.current; node.showModal(); return () => node.close(); }, []);
  return <dialog ref={ref} onCancel={onClose} aria-labelledby="dialog-heading"><div className="dialog-head"><h2 id="dialog-heading">{title}</h2><button onClick={onClose} aria-label="Close dialog">×</button></div><div className="dialog-body">{children}</div></dialog>;
}
function Evidence({ ids, artifact, source }) {
  const claims = artifact.evidence.claims.filter(c => ids.includes(c.id));
  const refs = [...new Set(claims.flatMap(c => c.refs))];
  return <details className="evidence"><summary>Why this fits <span>+</span></summary><div><p>These are the parts of your answers behind this interpretation. You can disagree or add context.</p>{refs.map(id => {
    const answer = source.answers.find(x => x.question_id === id);
    const question = (source.questions||QUESTIONS).find(x => x.id === id);
    return answer ? <blockquote key={id}><small>{question?.prompt || id}</small><p>{answer.text}</p></blockquote> : null;
  })}</div></details>;
}
function VectorMap({ artifact, onSelect }) {
  const vectors = artifact.domains.vectors.map(v=>({...v,...artifact.reading.vectors?.find(p=>p.id===v.id)}));
  const complete = vectors.every(x => x.position >= 0);
  const polygon = vectors.map((v, i) => { const p = point(i, 42 + v.position / 4 * 113); return `${p.x},${p.y}`; }).join(' ');
  return <section className="personality-map" id="your-map" aria-labelledby="map-title">
    <div className="map-copy"><span className="eyebrow">Your personality at a glance</span><h2 id="map-title">A pattern.<br/>A whole person.</h2><p>{artifact.reading.map_intro||artifact.reading.portrait.paragraphs[0]}</p><a href="#this-is-you" className="light-link">Read This Is You <span>↘</span></a></div>
    <div className="map-graphic"><svg viewBox="0 0 520 520" role="img" aria-label={`Eight-vector personality map for ${artifact.subject.name}. Broad interpretations; tap a label below for meaning.`}>
      {[52, 86, 120, 155].map(r => <circle key={r} cx="260" cy="260" r={r} className="map-ring"/>)}
      {vectors.map((v, i) => { const axis = point(i, 172), label = point(i, 202), dot = point(i, v.position < 0 ? 172 : 42 + v.position / 4 * 113); return <g key={v.id}>
        <line x1="260" y1="260" x2={axis.x} y2={axis.y} className="map-axis"/>
        <circle cx={dot.x} cy={dot.y} r="6" fill={v.position < 0 ? 'none' : COLORS[i]} stroke={COLORS[i]} strokeWidth="2"/>
        <text x={label.x} y={label.y} textAnchor={label.x < 220 ? 'end' : label.x > 300 ? 'start' : 'middle'} className="map-label">{VECTORS[i].title}</text>
      </g>; })}
      {complete && <polygon points={polygon} className="map-contour"/>}<circle cx="260" cy="260" r="8" fill="#f3efe7"/>
    </svg><p className="map-caption">A picture of tendencies from your answers.<br/>Each direction has value. This is not a grade.{!complete && <><br/>An open dot means we need more information.</>}</p></div>
    <div className="vector-buttons">{vectors.map((v, i) => <button key={v.id} onClick={() => onSelect(v)} aria-label={`Explore ${VECTORS[i].title}`}><i style={{ background: COLORS[i] }}/><span>{VECTORS[i].title}</span><b>↗</b></button>)}</div>
  </section>;
}
function VectorDetail({ vector, artifact, source }) {
  const definition = VECTORS.find(v => v.id === vector.id);
  return <><p className="dialog-intro">{definition.meaning}</p><div className="tendency-scale" aria-label={`${definition.title}: ${region(vector.position)}`}><div className="scale-dots">{[0,1,2,3,4].map(n => <i key={n} className={n === vector.position ? 'chosen' : ''}/>)}</div><div className="scale-labels"><span>{definition.low}</span><span>{definition.high}</span></div></div>{vector.position<0&&<p className="context-note">Still open. Your answers do not yet give us enough to place this tendency.</p>}<p>{vector.interpretation}</p><div className="detail-pair"><section><h3>Where it helps</h3><p>{vector.helps}</p></section><section><h3>What to notice</h3><p>{vector.watch_for}</p></section></div><p className="context-note">{vector.context}</p><Evidence ids={vector.claim_ids} artifact={artifact} source={source}/></>;
}
function Feedback({artifact,section,saved}) {
  const [choice, setChoice] = useState(saved?.choice||'');
  const [text, setText] = useState(saved?.comment||'');
  const [status, setStatus] = useState(saved?'Your saved response. The original report is unchanged.':'');
  const [saving, setSaving] = useState(false);
  async function save(event) {
    event.preventDefault(); setSaving(true); setStatus('');
    try { await call('bos_feedback',{mm:artifact.mm,report_hash:artifact.artifact_sha256,section,choice,comment:text}); setStatus('Saved. Your feedback adds context; your original report stays the same.'); } catch(e) { setStatus(e.message); } finally { setSaving(false); }
  }
  return <div className="feedback"><span>Does this sound like you?</span><div className="feedback-choices">{[['fits','That fits'],['partly','Partly'],['misses','That misses me']].map(([id,label]) => <button key={id} aria-pressed={choice === id} onClick={() => {setChoice(id); setStatus('');}}>{label}</button>)}</div>{choice && <form onSubmit={save}><label>What should MORE understand?<textarea value={text} onChange={e => setText(e.target.value)} maxLength={2000} placeholder="Add a detail, an exception, or your side of the story."/></label><button type="submit" className="solid" disabled={saving}>{saving ? 'Saving…' : 'Save my response'}</button></form>}<p role="status">{status}</p></div>;
}
function StrengthVisual({ rows }) {
  return <aside className="strength-visual" aria-label="Strengths in different situations"><span className="eyebrow">The same strength, different conditions</span>{rows.map((row, i) => <div className="strength-row" key={i}><h4>{row.strength}</h4><div><small>When it helps</small><p>{row.helps}</p></div><div><small>When it gets stretched</small><p>{row.overuse}</p></div><div><small>A possibility to explore</small><p>{row.reset}</p></div></div>)}</aside>;
}
function PressureVisual({ pattern }) {
  return <aside className="pressure-visual" aria-label="Your pressure pattern"><span className="eyebrow">A pattern to notice</span><div className="pressure-flow">{[['The situation',pattern.trigger],['What it may mean to you',pattern.interpretation],['Your response',pattern.response],['What may help',pattern.recovery]].map(([label,value], i) => <section key={label}><span className="flow-number">0{i+1}</span><h4>{label}</h4><p>{value}</p></section>)}</div></aside>;
}
export default function App() {
 const [data,setData]=useState(null),[error,setError]=useState(''),[modal,setModal]=useState(null);
 useEffect(()=>{call('get_report',{service:'bos',mm:new URLSearchParams(location.search).get('mm')}).then(setData).catch(e=>setError(e.message));},[]);
 const artifact=data?.artifact,source=data?.source;
 useEffect(()=>{if(artifact)document.title=`MORE · ${artifact.subject.name.split(' ')[0]}’s Youth BOS`;},[artifact]);
 if(!artifact)return <main className="waiting"><h1>{error||'Opening your personality profile…'}</h1><a href="/athlete/workspace/index.html#home">Your Athlete home</a></main>;
 return <><header className="topbar"><a className="brand" href="/athlete/workspace/index.html#home">MORE<span> ATHLETE</span></a><a href="/athlete/workspace/index.html#home">← Your Athlete home</a></header>
      <section className="hero"><div><span className="eyebrow">Your Behavioral Operating System</span><h1>{artifact.subject.name.split(' ')[0]},<span>this is you.</span></h1><p>A closer look at what makes you who you are.</p></div><div className="identity"><span>{artifact.subject.age} · {artifact.subject.sport}</span><code>{artifact.mm}</code><a href="/athlete/workspace/index.html#bos">Review my answers ↗</a><button className="text-link" onClick={() => setModal({ type:'answers' })}>Your answers ↗</button><button className="text-link" onClick={() => window.print()}>Print / save PDF ↗</button></div></section>
      <VectorMap artifact={artifact} onSelect={v => setModal({type:'vector',vector:v})}/>
      <div className="reading-layout" id="reading"><nav className="contents" aria-label="Reading contents"><span className="eyebrow">Your reading</span><a href="#this-is-you" className="contents-opening">This Is You</a>{CHAPTERS.map((c,i) => <a key={c.id} href={`#${c.id}`}><span>{String(i+1).padStart(2,'0')}</span>{c.title}</a>)}<a className="back-map" href="#your-map">↑ Your personality map</a></nav>
      <main className="reading"><article id="this-is-you" className="portrait"><span className="eyebrow">This Is You</span><h2>{artifact.reading.portrait.headline}</h2><div className="prose">{artifact.reading.portrait.paragraphs.map((p,i) => <p key={i}>{p}</p>)}</div><Evidence ids={artifact.reading.portrait.claim_ids} artifact={artifact} source={source}/><Feedback key={artifact.artifact_sha256} artifact={artifact} section="portrait" saved={data.feedback?.portrait}/></article>
      {artifact.reading.chapters.map((chapter,i) => <article id={chapter.id} className="chapter" key={`${artifact.artifact_sha256}-${chapter.id}`}><header><span className="chapter-number">{String(i+1).padStart(2,'0')}</span><span className="eyebrow">{CHAPTERS[i].title}</span></header><h2>{chapter.headline}</h2><div className="prose">{chapter.paragraphs.map((p,n) => <p key={n}>{p}</p>)}</div><p className="takeaway">{chapter.takeaway}</p>{chapter.id === 'pressure' && <PressureVisual pattern={artifact.reading.pressure_visual||artifact.synthesis.pressure_visual}/ >}{chapter.id === 'strengths' && <StrengthVisual rows={artifact.reading.strength_visual||artifact.synthesis.strength_visual}/ >}<Evidence ids={chapter.claim_ids} artifact={artifact} source={source}/><Feedback artifact={artifact} section={chapter.id} saved={data.feedback?.[chapter.id]}/></article>)}
      <footer className="closing"><span className="eyebrow">The picture can grow with you</span><p>{artifact.reading.closing}</p><a href="#this-is-you">Back to This Is You ↑</a></footer></main></div><a className="reading-jump" href="#reading" aria-label="Back to reading contents">Contents ↑</a>
<footer className="site-footer"><a href="/athlete/workspace/index.html#home">Back to your next step →</a><a href="/athlete/workspace/index.html#home">← Your Athlete home</a></footer>
    {modal && artifact && <Dialog title={modal.type === 'vector' ? VECTORS.find(v => v.id === modal.vector.id).title : `${artifact.subject.name.split(' ')[0]}'s answers`} onClose={() => setModal(null)}>{modal.type === 'vector' ? <VectorDetail vector={modal.vector} artifact={artifact} source={source}/> : <div className="answer-list">{source.answers.map((answer,i) => <section key={answer.question_id}><span className="eyebrow">Question {i+1}{answer.question_id.startsWith('F')?' · Personalized follow-up':''}</span><h3>{(source.questions||QUESTIONS).find(q => q.id === answer.question_id)?.prompt || answer.question_id}</h3><p>{answer.text}</p></section>)}</div>}</Dialog>}
  </>;
}
