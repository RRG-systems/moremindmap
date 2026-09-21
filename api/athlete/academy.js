import { waitUntil } from '@vercel/functions';
import { getAcademyRuntime } from '../../server/athleteAcademyV1/runtime.js';
export default async function handler(req,res){try{return await getAcademyRuntime().handler(req,res,{defer:waitUntil});}catch{res.setHeader('Cache-Control','no-store');return res.status(503).json({ok:false,error:{code:'ATHLETE_ACADEMY_NOT_AVAILABLE',message:'Athlete enrollment is not available yet.'}});}}
