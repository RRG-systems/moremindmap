import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('all four authenticated workspace entry points mount the shared boundary',()=>{
  for(const path of ['src/athleteAcademyV1/main.jsx','src/athleteAcademyV1/bos/main.jsx','src/athleteAcademyV1/apa/main.jsx','src/athleteAcademyV1/coach/main.jsx']) {
    const code=source(path);
    assert.match(code,/import ClientSessionBoundary/);
    assert.match(code,/<ClientSessionBoundary(?: publicSafety)?><App\/><\/ClientSessionBoundary>/);
  }
});
test('private invitation token ref is retained by outer document boundary and consumed by App',()=>{
  const boundary=source('src/athleteAcademyV1/ClientSessionBoundary.jsx');
  const app=source('src/athleteAcademyV1/App.jsx');
  assert.match(boundary,/const privateTokenRef = useRef/);
  assert.match(boundary,/cloneElement\(children, \{key:version, privateTokenRef\}\)/);
  assert.match(app,/const privateToken=privateTokenRef\|\|ownPrivateToken/);
  assert.match(app,/privateToken\.current=''/);
  assert.doesNotMatch(boundary,/localStorage|sessionStorage|replaceState/);
});
test('public Safety help remains independent of account confirmation',()=>{
  const boundary=source('src/athleteAcademyV1/ClientSessionBoundary.jsx');
  assert.match(source('src/athleteAcademyV1/main.jsx'),/<ClientSessionBoundary publicSafety>/);
  assert.match(boundary,/if \(safety\) return <SafetyHelp\/>/);
  assert.match(boundary,/hashchange/);
  assert.match(boundary,/href="\/athlete\/workspace\/index\.html#safety"/);
});
test('focus checks mask cached UI without changing its key until invalidation',()=>{
  const code=source('src/athleteAcademyV1/ClientSessionBoundary.jsx');
  assert.match(code,/display:checking\?'none':'contents'/);
  assert.match(code,/inert=\{checking \|\| undefined\}/);
  assert.match(code,/if \(event\.kind === 'invalidated'\) \{ clear\(\); void recheck\(\); \}/);
  assert.match(code,/setVersion\(value => value \+ 1\)/);
});
test('boundary clears private document title and drops post-unmount recheck updates',()=>{
  const code=source('src/athleteAcademyV1/ClientSessionBoundary.jsx');
  assert.match(code,/document\.title = 'MORE \/ ATHLETE'/);
  assert.match(code,/request !== counter\.current/);
  assert.match(code,/active = false/);
});
