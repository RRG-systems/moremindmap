import {call,bootstrap} from '../transport.js';
export async function api(path,body){const [kind,mm]=path.split('/');
 if(kind==='registry'){const s=await bootstrap();return s.athletes.map(x=>({...x,slug:x.mm}));}
 if(kind==='bundle')return call('coach_bundle',{mm});
 if(kind==='state')return (await call('coach_state',{mm})).state;
 if(kind==='action'){const {revision,requestId,speaker:_SPEAKER,actor:_ACTOR,...command}=body;return (await call('coach_action',{mm,revision,requestId,command})).state;}
 throw Error('This view is unavailable.');
}
