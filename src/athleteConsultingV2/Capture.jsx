import React, {useEffect, useRef, useState} from 'react';
import {api} from './transport.js';
import './capture.css';
import './coach-connect.css';

const consulting = slug => `/athlete-consulting-tool/demo?athlete=${slug}#home`;
const coachConnectMode = new URLSearchParams(location.search).get('role') === 'coach';
const dataOf = blob => new Promise((resolve,reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = reject; reader.readAsDataURL(blob);
});
async function photoOf(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 12000000) throw Error('Choose a JPEG, PNG or WebP photo under 12 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src=url; await img.decode();
    const canvas=document.createElement('canvas'), scale=Math.min(1,1000/Math.max(img.width,img.height));
    canvas.width=Math.round(img.width*scale); canvas.height=Math.round(img.height*scale);
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.65));
    if (!blob || blob.size>250000) throw Error('This photo is too detailed for the small demo. Choose a smaller image.');
    return {mime:'image/jpeg',data:await dataOf(blob)};
  } finally {URL.revokeObjectURL(url);}
}
function audioDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), audio = new Audio();
    let done = false;
    const timer = setTimeout(() => finish(null, Error('This voice file could not be checked. Try a short M4A, MP3, WebM or WAV file.')), 7000);
    const finish = (duration, error) => {
      if (done) return;
      done = true; clearTimeout(timer);
      audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(url);
      if (error) reject(error); else resolve(duration);
    };
    audio.onloadedmetadata = () => finish(audio.duration);
    audio.onerror = () => finish(null, Error('This voice file could not be checked. Try a short M4A, MP3, WebM or WAV file.'));
    audio.src = url;
  });
}
function Media({items}) {return items.map((a,i)=>a.mime.startsWith('image/')
  ? <img key={i} src={`data:${a.mime};base64,${a.data}`} alt="Attached demo observation"/>
  : <audio key={i} controls src={`data:${a.mime};base64,${a.data}`}/>);}

export default function Capture() {
  const [roster,setRoster]=useState([]),[role,setRole]=useState(coachConnectMode?'coach':''),[slug,setSlug]=useState(null),[search,setSearch]=useState('');
  const [state,setState]=useState(null),[text,setText]=useState(''),[media,setMedia]=useState([]),[reviewed,setReviewed]=useState(false);
  const [busy,setBusy]=useState(false),[recording,setRecording]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');
  const recorder=useRef(),timer=useRef(),stream=useRef(),pending=useRef(),photoInput=useRef(),audioInput=useRef(),mounted=useRef(true);
  useEffect(()=>{api('registry').then(setRoster).catch(e=>setError(e.message));return()=>{mounted.current=false;clearTimeout(timer.current);recorder.current?.stop();stream.current?.getTracks().forEach(t=>t.stop());};},[]);
  useEffect(()=>{let active=true;setState(null);if(slug)api('state/'+slug).then(s=>{if(active)setState(s);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[slug]);
  const person=roster.find(p=>p.slug===slug), dirty=!!text.trim()||media.length>0, locked=busy||recording;
  function selectAthlete(next) {
    if(locked||dirty||!roster.some(p=>p.slug===next))return;
    setSlug(next);setText('');setMedia([]);setReviewed(false);setError('');setSaved('');pending.current=null;
  }
  async function transcribe(file,{recorded=false}={}) {
    if(!file||!slug)return;
    setBusy(true);setError('');setSaved('');
    try {
      const mime=file.type.split(';')[0];
      if(!/^audio\/(mp4|m4a|x-m4a|mp3|mpeg|webm|wav|x-wav)$/.test(mime)||file.size>250000||file.size<100)
        throw Error('Choose a voice note under 250 KB in M4A, MP3, WebM or WAV format.');
      if(!recorded) {
        const duration=await audioDuration(file);
        if(!Number.isFinite(duration)||duration<=0||duration>30)
          throw Error('Choose a voice note that is 30 seconds or shorter.');
      }
      const fresh=await api('state/'+slug);
      const result=await api('transcribe/'+slug,{action:'transcribe_coach_voice',requestId:crypto.randomUUID(),audio:{mime,data:await dataOf(file)}},fresh._transport);
      if(mounted.current){setText(prior=>[prior.trim(),result.text].filter(Boolean).join('\n\n'));setReviewed(false);}
    } catch(e){if(mounted.current)setError(e.message==='VOICE_TRANSCRIPTION_DISABLED'?'Voice transcription is not enabled here yet. You can type a note instead.':e.message==='VOICE_RATE_LIMITED'?'Voice transcription has reached its demo limit. You can type a note instead.':e.message==='VOICE_ALREADY_ATTEMPTED'?'That voice note was already attempted. You can type the note instead.':e.message==='VOICE_TRANSCRIPTION_FAILED'?`The voice note could not be transcribed. Your current draft is safe; please try typing it.${e.voice_diagnostic_id?` Reference ${e.voice_diagnostic_id}.`:''}`:e.message);} finally {if(mounted.current)setBusy(false);}
  }
  async function attachment(file,isPhoto) {
    if (!file) return;
    setBusy(true);setError('');setSaved('');
    try {
      let item;
      if(isPhoto)item=await photoOf(file);
      else {
        const mime=file.type.split(';')[0];
        if(!/^audio\/(mp4|m4a|mpeg|webm|wav|x-wav)$/.test(mime)||file.size>250000)throw Error('Choose an MP4, M4A, MP3, WebM or WAV voice note under 250 KB.');
        item={mime,data:await dataOf(file)};
      }
      if(mounted.current){setMedia([item]);setReviewed(false);}
    } catch(e){setError(e.message);} finally {setBusy(false);}
  }
  async function record() {
    if(recording){recorder.current?.stop();return;}
    setError('');setSaved('');
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setError('Recording is unavailable here. Attach a short voice note or use your keyboard microphone to dictate text.');return;}
    setBusy(true);
    try {
      stream.current=await navigator.mediaDevices.getUserMedia({audio:true});
      if(!mounted.current){stream.current.getTracks().forEach(t=>t.stop());return;}
      const mime=['audio/webm;codecs=opus','audio/mp4'].find(m=>MediaRecorder.isTypeSupported(m));
      if(!mime)throw Error('Use an audio file or keyboard dictation on this device.');
      const r=new MediaRecorder(stream.current,{mimeType:mime,audioBitsPerSecond:32000}),chunks=[];recorder.current=r;
      r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      r.onstop=async()=>{clearTimeout(timer.current);stream.current?.getTracks().forEach(t=>t.stop());recorder.current=null;
        if(mounted.current){setRecording(false);const file=new Blob(chunks,{type:mime.split(';')[0]});
          if(coachConnectMode)await transcribe(file,{recorded:true});else await attachment(file,false);}};
      r.start();setRecording(true);timer.current=setTimeout(()=>{if(r.state==='recording')r.stop();},30000);
    }catch(e){stream.current?.getTracks().forEach(t=>t.stop());setError(e.name==='NotAllowedError'?'Microphone access was not granted. You can type or attach an audio file.':e.message);}finally{setBusy(false);}
  }
  async function save() {
    if(locked||!state||!reviewed||!text.trim())return;
    setBusy(true);setError('');setSaved('');
    const capture={subject:slug,role,source:role==='coach'?'Coach Alex (synthetic)':person.name+' (synthetic)',
      kind:coachConnectMode?'text':media.some(a=>a.mime.startsWith('audio/'))?'voice':media.length?'photo':'text',text,attachments:coachConnectMode?[]:media,reviewed,
      ...(coachConnectMode?{channel:'coach_connect_box04_v1'}:{})};
    const signature=JSON.stringify(capture);
    const operation=pending.current?.signature===signature?pending.current.operation:{action:'capture_demo',requestId:crypto.randomUUID(),capture};
    pending.current={signature,operation};
    try {
      const fresh=await api('state/'+slug);
      const result=await api('action/'+slug,operation,fresh._transport);
      setState(result);setText('');setMedia([]);setReviewed(false);pending.current=null;
      setSaved(`Saved to ${person.name.split(' ')[0]}’s Consulting record.`);
    }catch(e){setError(e.message==='STATE_CHANGED_RELOAD'?'Another action updated the record. Your note is still here; tap Save again.':e.message==='CAPTURE_DEMO_MEDIA_FULL'?'This synthetic record has reached its demo media allowance. Remove the attachment to save the text.':e.message);}
    finally{setBusy(false);}
  }
  const notes=state?.messages.filter(m=>m.capture&&(!coachConnectMode||m.capture.role==='coach')).slice(-12).reverse()||[];
  const needsLeadershipSignIn=error==='Please enter through the shared Leadership gate.'||error==='Reopen through Leadership to continue.';
  return <main className="capture-app">
    <header><a className="capture-brand" href="/leadership" target="_top"><b>M</b><span>MORE <strong>ATHLETE</strong></span></a><span className="capture-status">{coachConnectMode?'COACH CONNECT · DEMO':'DARRENDEMO'}</span></header>
    <p className="capture-disclosure">{['localhost','127.0.0.1'].includes(location.hostname)?'Local rehearsal · No live writes':'Fictional athletes · Saved in your current DarrenDemo session'}</p>
    {!role?<section className="capture-intro"><span className="capture-eyebrow">THE MOMENTS BETWEEN SESSIONS</span><h1>Tell MORE<br/>what happened.</h1><p>A thought. A small win. Something to talk through next time.</p><button className="capture-primary" onClick={()=>setRole('athlete')}>I’m an athlete <span>→</span></button><button onClick={()=>setRole('coach')}>I’m a coach <span>→</span></button><small>Try either fictional demo role. Real academy accounts are not enabled.</small></section>
    :!slug?<section>{coachConnectMode?<a className="capture-back" href="/leadership-demo" target="_top">← All DarrenDemo products</a>:<button className="capture-back" onClick={()=>setRole('')}>← Change demo role</button>}<span className="capture-eyebrow">{role==='coach'?'COACH ALEX · SYNTHETIC':'ATHLETE · SYNTHETIC'}</span><h1>{role==='coach'?'Your athletes.':'Choose your demo.'}</h1><label>Find an athlete<input type="search" placeholder="Search name or sport" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="capture-roster">{roster.filter(p=>(p.name+' '+p.sport).toLowerCase().includes(search.toLowerCase())).map(p=><button key={p.slug} onClick={()=>selectAthlete(p.slug)}><span className="capture-avatar">{p.name[0]}</span><span><strong>{p.name}</strong><small>{p.sport} · Synthetic athlete</small></span><span>Open athlete →</span></button>)}</div></section>
    :<section><button className="capture-back" disabled={locked||dirty} onClick={()=>{setSlug(null);setError('');setSaved('');}}>← {role==='coach'?'All athletes':'Choose demo athlete'}</button><span className="capture-eyebrow">{role==='coach'?'COACH ALEX’S NOTE FOR':'YOUR SPACE'}</span><h1>{person?.name}</h1><p>{person?.sport} · Synthetic athlete</p>
      {coachConnectMode&&<><label className="capture-athlete-switch">Selected athlete<select value={slug} disabled={locked||dirty} onChange={e=>selectAthlete(e.target.value)}>{roster.map(p=><option value={p.slug} key={p.slug}>{p.name} · {p.sport}</option>)}</select></label>{dirty&&<small>Save or clear this note before changing athletes.</small>}</>}
      <a className="capture-open" href={consulting(slug)} target="_top" onClick={e=>{if(locked||dirty){e.preventDefault();setError('Save or clear your note before opening MORE.');}}}>Open MORE <span>↗</span></a>
      <div className="capture-composer"><h2>What happened today?</h2><div className="capture-tools"><button disabled={busy} onClick={record}>{recording?'Stop recording':coachConnectMode?'● Record voice':'● Voice note'}</button>{!coachConnectMode&&<button disabled={locked} onClick={()=>photoInput.current.click()}>＋ Photo</button>}<button disabled={locked} onClick={()=>audioInput.current.click()}>{coachConnectMode?'Upload voice note':'Attach audio'}</button></div>
        {!coachConnectMode&&<input hidden ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{attachment(e.target.files[0],true);e.target.value='';}}/>}
        <input hidden ref={audioInput} type="file" accept="audio/mp4,audio/m4a,audio/x-m4a,audio/mp3,audio/mpeg,audio/webm,audio/wav,audio/x-wav" onChange={e=>{const file=e.target.files[0];if(coachConnectMode)transcribe(file);else attachment(file,false);e.target.value='';}}/>
        {recording&&<p role="status">Recording… stops after 30 seconds.</p>}
        <label>{coachConnectMode?'Coach note or editable voice transcript':'Note or reviewed transcript'}<textarea placeholder="Tell MORE what you noticed…" maxLength={4000} rows={5} value={text} disabled={locked} onChange={e=>{setText(e.target.value);setReviewed(false);setSaved('');}}/></label>
        <small>{coachConnectMode?'Voice creates editable text for your review. Only your confirmed note is saved to the Consulting record; audio is not kept. A coach observation is not an automatic plan change.':'Type or use your keyboard microphone to dictate. Audio needs a written summary here; automatic audio transcription is not connected in this live demo. Photos are kept for review, not automatically interpreted.'}</small>
        <div className="capture-media"><Media items={media}/></div>
        {media.length>0&&<button disabled={locked} onClick={()=>{setMedia([]);setReviewed(false);}}>Remove attachment</button>}
        <label className="capture-check"><input type="checkbox" checked={reviewed} disabled={locked} onChange={e=>setReviewed(e.target.checked)}/><span>I reviewed this fictional note{coachConnectMode?' or edited transcript':''} and its selected athlete.</span></label>
        <button className="capture-primary" disabled={locked||!state||!text.trim()||!reviewed} onClick={save}>{busy?'Working…':`Save to ${person?.name.split(' ')[0]}’s notes`} <span>→</span></button>
        {dirty&&<button className="capture-back" disabled={locked} onClick={()=>{setText('');setMedia([]);setReviewed(false);pending.current=null;}}>Clear unsaved note</button>}
        <p className="capture-fine">Source: {role==='coach'?'Coach Alex':person?.name} (synthetic). {coachConnectMode?'This reviewed Coach Alex note will be shared with the selected athlete’s next successful Start My Session opening.':'Saving adds an unverified observation for Consulting.'} It does not approve a plan or change BOS, APA or approved learning.</p>
      </div>
      {saved&&<p className="capture-success" role="status">✓ {saved} {coachConnectMode?'The note is ready for this athlete’s next session.':'Open MORE to see it in the conversation.'}</p>}
      <div className="capture-notes"><h2>Recent captured notes</h2>{!state?<p>Loading the saved record…</p>:!notes.length?<p>Your first observation can start here.</p>:notes.map(m=><article key={m.id}><small>{m.capture.source} · {new Date(m.at).toLocaleString()}</small><p>{m.text}</p><div className="capture-media"><Media items={m.capture.attachments}/></div></article>)}</div>
    </section>}
    {error&&<div className="capture-error" role="alert"><p>{error}</p>{needsLeadershipSignIn&&<a href="/leadership" target="_top">Open the existing Leadership sign-in</a>}</div>}
  </main>;
}
