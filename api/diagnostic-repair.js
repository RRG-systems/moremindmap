// Diagnostic endpoint to expose repair pass internals

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    res.status(200).json({
      ok: true,
      route: "diagnostic-repair",
      timestamp: new Date().toISOString(),
      message: "Minimal diagnostic endpoint working"
    })
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    })
  }
}
