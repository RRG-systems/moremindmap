export default async function handler(req, res) {
  try {
    const { buildProfileInput } = await import("./engine/buildProfileInput.js")
    res.status(200).json({ 
      success: true, 
      message: "Import successful",
      hasFunction: typeof buildProfileInput === 'function'
    })
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    })
  }
}
