export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS")
  
  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  const diagnostic = {
    openai_api_key_present: !!process.env.OPENAI_API_KEY,
    openai_api_key_length: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0,
    openai_model: process.env.OPENAI_MODEL || 'gpt-5.5 (default)',
    node_env: process.env.NODE_ENV || 'not set',
    vercel_env: process.env.VERCEL_ENV || 'not set',
    timestamp: new Date().toISOString()
  }
  
  res.status(200).json(diagnostic)
}
