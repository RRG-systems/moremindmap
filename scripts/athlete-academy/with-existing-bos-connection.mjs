// Local-only harness for the explicitly approved existing BOS connection.
// Reads one named binding into memory. Never prints or saves the key.
import {execFileSync,spawn} from 'node:child_process';
let binding;try{binding=JSON.parse(execFileSync('vercel',['api','/v10/projects/prj_1cKulnhesboehHHZXgZaDqOnCdmn/env/qbdDu2COlruqg9yw?decrypt=true','--method','GET'],{encoding:'utf8',timeout:30000,maxBuffer:100000,stdio:['ignore','pipe','pipe']}));}catch{throw Error('EXISTING_BOS_CONNECTION_LOOKUP_FAILED');}
if(binding.key!=='OPENAI_API_KEY'||typeof binding.value!=='string'||binding.value.length<20)throw Error('EXISTING_BOS_CONNECTION_UNAVAILABLE');
const target=process.argv[2];if(!['scripts/athlete-academy/local-server.mjs','scripts/athlete-academy/generate-synthetic.mjs'].includes(target))throw Error('LOCAL_HARNESS_TARGET_REQUIRED');
const child=spawn(process.execPath,[target,...process.argv.slice(3)],{cwd:process.cwd(),env:{...process.env,OPENAI_API_KEY:binding.value,ATHLETE_ACADEMY_PROVIDER_ENABLED:'1'},stdio:'inherit'});binding.value='';
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));child.on('exit',code=>process.exitCode=code||0);
