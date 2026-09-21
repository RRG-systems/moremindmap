import {runAssessmentQueue,workerAuthorized} from './worker.js';
import {runMailQueue} from './delivery.js';

// Separate invocations have separate wall-clock budgets. A mail outage or slow
// recipient must never spend the assessment function's completion allowance.
export function createScheduledHandler({env,getRuntime,lane}){
 if(!['mail','assessments'].includes(lane))throw Error('WORKER_LANE_REQUIRED');
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
   workerAuthorized(env,req.headers.authorization);
   if(!['GET','POST'].includes(req.method))return res.status(405).json({ok:false});
   const runtime=getRuntime();
   const result=lane==='mail'?await runMailQueue(runtime):await runAssessmentQueue(runtime);
   return res.status(200).json({ok:true,...result});
  }catch(e){return res.status(e.status||503).json({ok:false,error:/^[A-Z_]+$/.test(e.code||'')?e.code:'WORKER_UNAVAILABLE'});}
 };
}
