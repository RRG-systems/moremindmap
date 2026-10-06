import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionEvents} from '../src/athleteAcademyV1/sessionEvents.js';

function browserPair() {
  const channels = new Set(), messages = [];
  class Channel {
    constructor(name) { this.name=name; this.listeners=[]; channels.add(this); }
    addEventListener(name, listener) { if(name==='message')this.listeners.push(listener); }
    postMessage(data) {
      messages.push(structuredClone(data));
      for(const peer of channels)if(peer!==this&&peer.name===this.name)
        for(const listener of peer.listeners)listener({data:structuredClone(data)});
    }
    close() { channels.delete(this); }
  }
  return {left:createSessionEvents({BroadcastChannel:Channel}),right:createSessionEvents({BroadcastChannel:Channel}),messages};
}
const student={account:{id:'fictional-student',role:'participant',mm:'MM-FICTIONAL'}};
const guardian={account:{id:'fictional-guardian',role:'guardian'}};

test('first authoritative observation does not invalidate a freshly loaded view',()=>{
  const events=createSessionEvents(null),seen=[];
  events.subscribe(event=>seen.push(event));
  assert.equal(events.observe(student),true);
  assert.equal(events.epoch(),0);
  assert.equal(seen.length,0);
});
test('same actor focus observation preserves the current view generation',()=>{
  const events=createSessionEvents(null),seen=[];
  events.observe(student);events.subscribe(event=>seen.push(event));
  assert.equal(events.observe(structuredClone(student)),true);
  assert.equal(events.epoch(),0);assert.deepEqual(seen,[]);
});
test('a different authenticated actor invalidates cached private content',()=>{
  const events=createSessionEvents(null),seen=[];
  events.observe(student);events.subscribe(event=>seen.push(event));events.observe(guardian);
  assert.equal(events.epoch(),1);assert.deepEqual(seen,[{kind:'actor-changed',epoch:1}]);
});
test('expired authenticated identity becoming anonymous invalidates cached content',()=>{
  const events=createSessionEvents(null),seen=[];
  events.observe(student);events.subscribe(event=>seen.push(event));events.observe({account:null});
  assert.equal(events.actor(),'anonymous');assert.equal(seen[0].kind,'actor-changed');
});
test('stale bootstrap observation cannot restore an old authenticated identity',()=>{
  const events=createSessionEvents(null);events.observe(student);const old=events.epoch();events.invalidate();
  assert.equal(events.observe(student,old),false);assert.equal(events.actor(),null);
});
test('auth change reaches another page without an echo loop or private payload',()=>{
  const {left,right,messages}=browserPair(),a=[],b=[];
  left.subscribe(event=>a.push(event));right.subscribe(event=>b.push(event));
  left.observe(student);right.observe(student);left.invalidate(true);
  assert.equal(a.length,1);assert.equal(b.length,1);
  assert.equal(left.actor(),null);assert.equal(right.actor(),null);
  assert.deepEqual(messages,[{kind:'session-changed'}]);
  assert.deepEqual(Object.keys(messages[0]),['kind']);left.close();right.close();
});
test('broadcasting is optional and absent browser support still invalidates locally',()=>{
  const events=createSessionEvents(null),seen=[];events.subscribe(event=>seen.push(event));events.invalidate(true);
  assert.deepEqual(seen,[{kind:'invalidated',epoch:1}]);
});
test('one failed subscriber cannot suppress other private-view invalidations',()=>{
  const events=createSessionEvents(null),seen=[];
  events.subscribe(()=>{throw Error('fictional faulty view');});events.subscribe(event=>seen.push(event));
  events.invalidate();assert.equal(seen[0].kind,'invalidated');
});
test('unsubscribed views do not receive later events',()=>{
  const events=createSessionEvents(null),seen=[],remove=events.subscribe(event=>seen.push(event));
  remove();events.invalidate();assert.equal(seen.length,0);
});
