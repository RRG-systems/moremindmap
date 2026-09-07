export default async function handler(req, res) {
  return res.status(200).json({
    success: true,
    route: "/api/moremindmap/ping",
    timestamp: new Date().toISOString()
  });
}
