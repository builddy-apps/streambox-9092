import express from 'express';
import cors from 'cors';
import db from './db.js';
import contentRoutes from './routes/content.js';
import userRoutes from './routes/user.js';
import extensionRoutes from './routes/extensions.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS middleware
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  const uptime = process.uptime();
  const uptimeFormatted = `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: uptimeFormatted,
    uptime_seconds: uptime
  });
});

// Mount API routes
app.use('/api/content', contentRoutes);
app.use('/api', userRoutes);
app.use('/api/extensions', extensionRoutes);

// Serve static frontend files
app.use(express.static('frontend', {
  index: ['index.html'],
  fallthrough: true
}));

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
    return next();
  }
  res.sendFile('index.html', { root: 'frontend' }, (err) => {
    if (err) {
      next(err);
    }
  });
});

// 404 handler for API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      error: 'Endpoint not found'
    });
  }
  next();
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Handle JSON parse errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON in request body'
    });
  }
  
  // Handle database errors
  if (err.code && err.code.startsWith('SQLITE')) {
    return res.status(500).json({
      success: false,
      error: 'Database error occurred'
    });
  }
  
  // Default error response
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`StreamBox server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Static files: http://localhost:${PORT}/`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

export default app;