// Test updateJob array handling
import { createJob, updateJob, getJob } from './engine/miniV2JobManager.js'

export default async function handler(req, res) {
  try {
    // Create test job
    const jobId = await createJob({ test: true })
    
    // Read initial state
    const initial = await getJob(jobId)
    const initialMissing = initial.missingFields
    
    // Update with empty array
    await updateJob(jobId, { missingFields: [] })
    const afterEmpty = await getJob(jobId)
    const afterEmptyValue = afterEmpty.missingFields
    
    // Update with populated array
    await updateJob(jobId, { missingFields: ['field1', 'field2'] })
    const afterPopulated = await getJob(jobId)
    const afterPopulatedValue = afterPopulated.missingFields
    
    return res.status(200).json({
      success: true,
      test: 'updateJob array handling',
      initial: {
        value: initialMissing,
        type: typeof initialMissing,
        isArray: Array.isArray(initialMissing)
      },
      after_empty_array: {
        value: afterEmptyValue,
        type: typeof afterEmptyValue,
        isArray: Array.isArray(afterEmptyValue)
      },
      after_populated: {
        value: afterPopulatedValue,
        type: typeof afterPopulatedValue,
        isArray: Array.isArray(afterPopulatedValue),
        length: Array.isArray(afterPopulatedValue) ? afterPopulatedValue.length : null
      }
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
