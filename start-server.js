const app = require("./server")

const PORT = process.env.PORT || 3000

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📱 Local API: http://localhost:${PORT}/api`)
  console.log(`🌐 Network API: http://0.0.0.0:${PORT}/api`)
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`)
})
