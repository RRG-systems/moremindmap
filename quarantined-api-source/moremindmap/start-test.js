// Minimal test version - zero dependencies
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  return res.status(200).json({
    success: true,
    route: 'start-test',
    timestamp: new Date().toISOString()
  })
}
