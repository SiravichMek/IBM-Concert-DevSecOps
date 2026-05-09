const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'IBM Concert Demo'
  });
});

// Ready check endpoint
app.get('/ready', (req, res) => {
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'IBM Concert DevSecOps Demo Application',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      ready: '/ready',
      info: '/info'
    }
  });
});

// Info endpoint
app.get('/info', (req, res) => {
  res.json({
    application: 'IBM Concert Demo',
    version: '1.0.0',
    description: 'Demo application for IBM Concert SBOM and CVE scanning',
    features: [
      'Automated SBOM generation with Syft',
      'Vulnerability scanning with Grype',
      'Image signing with Cosign',
      'IBM Concert Toolkit integration'
    ],
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    }
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`IBM Concert Demo application listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Ready check: http://localhost:${PORT}/ready`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

// Made with Bob
