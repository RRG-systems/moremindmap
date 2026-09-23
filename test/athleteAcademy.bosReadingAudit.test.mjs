import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 READING_AUDIT_VERSION,
 READING_CORRECTION_VERSION,
 applyReadingCorrection,
 readingAuditPrompt,
 readingCorrectionPrompt,
 requireReadingAuditPass,
 validateReadingAudit,
} from '../server/athleteAcademyV1/bos/readingAudit.js';

// Existing fictional fixture only. No participant answers or provider calls.
const fixture=JSON.parse(await readFile(new URL('../server/athleteConsultingV2/fixtures/sofia.json',import.meta.url)));
const reading=fixture.bos.reading;
const evidence=fixture.bos.evidence;
const intake={answers:fixture.bos_source.answers,corrections:[{id:'CORR01'}]};
const finding=(path,quote,severity='material',question_ids=['Q01'])=>({path,quote,severity,reason:'A synthetic factual discrepancy for the contract test.',question_ids});
const audit=(findings,pass=!findings.some(x=>x.severity==='material'))=>({audit_version:READING_AUDIT_VERSION,pass,findings});
const patch=changes=>({correction_version:READING_CORRECTION_VERSION,changes});

test('factual audit accepts clean and minor verdicts, but separately blocks a material verdict',()=>{
 const clean=audit([]),minor=audit([finding('reading.map_intro',reading.map_intro.slice(0,20),'minor')]);
 assert.equal(validateReadingAudit(clean,reading,intake),clean);
 assert.equal(requireReadingAuditPass(clean),clean);
 assert.equal(validateReadingAudit(minor,reading,intake),minor);
 assert.equal(requireReadingAuditPass(minor),minor);
 const material=audit([finding('reading.map_intro',reading.map_intro.slice(0,20))]);
 assert.equal(validateReadingAudit(material,reading,intake),material);
 assert.throws(()=>requireReadingAuditPass(material),/READING_NEEDS_FACTUAL_REVIEW/);
 assert.match(readingAuditPrompt(),/exact public words/);
 assert.match(readingCorrectionPrompt(),/exactly one complete replacement string/);
});

test('audit findings must cite an actual public string leaf, literal quote, and supplied answer or correction ID',()=>{
 const good=[
  finding('reading.portrait.headline',reading.portrait.headline),
  finding('reading.portrait.paragraphs[0]',reading.portrait.paragraphs[0].slice(0,15)),
  finding('reading.chapters[0].takeaway',reading.chapters[0].takeaway.slice(0,15),'minor'),
  finding('reading.chapters[0].paragraphs[0]',reading.chapters[0].paragraphs[0].slice(0,15)),
  finding('reading.vectors[0].interpretation',reading.vectors[0].interpretation.slice(0,15)),
  finding('reading.strength_visual[0].reset',reading.strength_visual[0].reset.slice(0,15)),
  finding('reading.pressure_visual.trigger',reading.pressure_visual.trigger.slice(0,15),'minor',['CORR01']),
  finding('reading.closing',reading.closing.slice(0,15),'minor'),
 ];
 assert.equal(validateReadingAudit(audit(good),reading,intake).findings.length,good.length);
 for(const path of ['reading.portrait','reading.portrait.claim_ids[0]','reading.chapters[99].takeaway','reading.chapters[00].takeaway','reading.__proto__.polluted','reading.constructor.prototype.polluted','reading.answers[0].text']){
  assert.throws(()=>validateReadingAudit(audit([finding(path,'You')]),reading,intake),/INVALID_AUDIT_FINDING/,path);
 }
 for(const invalid of [
  finding('reading.map_intro','not present anywhere'),
  finding('reading.map_intro',reading.map_intro[0]),
  finding('reading.map_intro','  '),
  finding('reading.map_intro',reading.map_intro.slice(0,20),'material',[]),
  finding('reading.map_intro',reading.map_intro.slice(0,20),'material',['Q99']),
  {...finding('reading.map_intro',reading.map_intro.slice(0,20)),reason:'  '},
 ])assert.throws(()=>validateReadingAudit(audit([invalid]),reading,intake),/INVALID_AUDIT_FINDING/);
 assert.throws(()=>validateReadingAudit(audit([good[0]],true),reading,intake),/AUDIT_VERDICT_MISMATCH/);
 assert.throws(()=>validateReadingAudit(audit([]),reading,{answers:[]}),/INVALID_AUDIT_CONTEXT/);
});

test('one targeted correction per distinct material path changes only those public strings',()=>{
 const findings=[
  finding('reading.map_intro',reading.map_intro.slice(0,20)),
  finding('reading.vectors[0].helps',reading.vectors[0].helps.slice(0,12)),
  finding('reading.pressure_visual.trigger',reading.pressure_visual.trigger.slice(0,12)),
  finding('reading.chapters[0].takeaway',reading.chapters[0].takeaway.slice(0,12),'minor'),
 ];
 const original=structuredClone(reading),savedAudit=audit(findings),changes=[
  {path:'reading.map_intro',text:`${reading.map_intro} Today.`},
  {path:'reading.vectors[0].helps',text:`${reading.vectors[0].helps} Sometimes.`},
  {path:'reading.pressure_visual.trigger',text:`${reading.pressure_visual.trigger} Sometimes.`},
 ];
 validateReadingAudit(savedAudit,reading,intake);
 const corrected=applyReadingCorrection(reading,patch(changes),savedAudit,evidence);
 const expected=structuredClone(original);
 expected.map_intro=changes[0].text;
 expected.vectors[0].helps=changes[1].text;
 expected.pressure_visual.trigger=changes[2].text;
 assert.deepEqual(corrected,expected);
 assert.deepEqual(reading,original,'original reading stays immutable');
 assert.deepEqual(savedAudit,audit(findings),'original audit stays immutable');
});

test('correction rejects missing, duplicate, extra, metadata, and unsafe changes',()=>{
 const material=audit([finding('reading.map_intro',reading.map_intro.slice(0,20))]);
 const correct={path:'reading.map_intro',text:`${reading.map_intro} Today.`};
 for(const invalid of [
  patch([]),
  patch([correct,correct]),
  patch([{path:'reading.portrait.headline',text:'Other heading'}]),
  patch([{path:'reading.__proto__.polluted',text:'Polluted'}]),
  patch([{...correct,extra:true}]),
  patch([{...correct,text:reading.map_intro}]),
  patch([{...correct,text:'   '}]),
  {...patch([correct]),reading:{}},
  {...patch([correct]),correction_version:'unknown'},
 ])assert.throws(()=>applyReadingCorrection(reading,invalid,material,evidence),/INVALID_READING_CORRECTION/);
 assert.equal(Object.prototype.polluted,undefined);
 assert.throws(()=>applyReadingCorrection(reading,patch([correct]),audit([]),evidence),/INVALID_CORRECTION_AUDIT/);
 assert.throws(()=>applyReadingCorrection(reading,patch([{path:'reading.map_intro',text:'Too short.'}]),material,evidence),/MAP_COPY_LENGTH/);
});
