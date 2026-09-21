import process from 'node:process';
import {getAcademyRuntime} from '../../server/athleteAcademyV1/runtime.js';
import {createScheduledHandler} from '../../server/athleteAcademyV1/scheduled.js';
export default createScheduledHandler({env:process.env,getRuntime:getAcademyRuntime,lane:'assessments'});
