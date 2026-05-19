// Test uuid import
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  
  const testId = uuidv4()
  
  return res.status(200).json({
    success: true,
    route: 'start-test4-uuid',
    test_uuid: testId
  })
}
