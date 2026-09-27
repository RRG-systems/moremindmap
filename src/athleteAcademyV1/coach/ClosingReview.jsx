import React from 'react';
import AthleteVisual from '../../athleteConsultingV2/AthleteVisual.jsx';
import AthleteText from '../../athleteConsultingV2/AthleteText.jsx';

export default function ClosingReview({state,visual,working,remember,setRemember,act,navigate,setChatOpen,reviewRef}) {
  if (!state.closing) return null;
  if (state.flagship_enabled && !state.closing_reveal_ready) return <section ref={reviewRef}
    className="closing-card" role="status" aria-label="Session closing review" tabIndex="-1">
    <h2>Refresh this closing review</h2>
    <p>{state.sessionStartMap==null?'This earlier session has no saved start map, so its before-and-after comparison is unavailable.':'This closing review needs the latest saved map.'} Your conversation and plan remain saved.</p>
    <button className="primary" disabled={working} onClick={()=>act({action:'close'})}>Refresh closing review</button>
    <button disabled={working} onClick={()=>act({action:'continue'})}>Keep talking</button>
  </section>;
  return <section ref={reviewRef} className="closing-card" aria-label="Session closing review" tabIndex="-1">
    <span className="eyebrow">BEFORE YOU GO</span>
    {visual&&<AthleteVisual plan={visual.plan} className="athlete-visual-closing"/>}
    <AthleteText value={state.closing.summary}/>
    {state.draft&&<button onClick={()=>{navigate('plan');setChatOpen(false);}}>Review proposed plan →</button>}
    {state.suggestedLearning.length>0&&<fieldset><legend>Keep for next time?</legend>
      {state.suggestedLearning.map((t,i)=><label className="check-label" key={i}><input type="checkbox"
        checked={remember.includes(t)} onChange={e=>setRemember(e.target.checked?[...remember,t]:remember.filter(x=>x!==t))}/><span>{t}</span></label>)}
    </fieldset>}
    <div className="actions"><button className="primary" disabled={working} onClick={async()=>{
      await act({action:'finish',remember});setRemember([]);
    }}>{remember.length?'Save preferences & finish':'Finish session'}</button>
    <button disabled={working} onClick={()=>act({action:'continue'})}>Keep talking</button></div>
  </section>;
}
