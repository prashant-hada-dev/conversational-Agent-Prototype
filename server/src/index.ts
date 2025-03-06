import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import config from './config/config';
import { ERROR_CODES, ErrorResponse } from './types/chat';
import WebSocketService from './services/websocket.service';
import { checkRedisConnection } from './utils/redis-check';

const app = express();
const server = http.createServer(app);

// Configure CORS
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials
}));

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  const errorResponse: ErrorResponse = {
    error: err.message || 'Internal server error',
    code: ERROR_CODES.SERVER_ERROR,
  };

  res.status(500).json(errorResponse);
});

// Start server
const startServer = async () => {
  try {
    // Check Redis connection
    const redisConnected = await checkRedisConnection();
    if (!redisConnected) {
      console.error('Failed to connect to Redis. Exiting...');
      process.exit(1);
    }

    // Initialize WebSocket service
    const wsService = new WebSocketService(server);

    // Start HTTP server
    const port = config.port;
    server.listen(port, () => {
      console.log('\n=== AI Sales Agent Server ===');
      console.log(`✅ HTTP server running on port ${port}`);
      console.log(`✅ WebSocket server running on path ${config.wsConfig.path}`);
      console.log(`✅ Redis connected at ${config.redis.host}:${config.redis.port}`);
      console.log('============================\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
const gracefulShutdown = async () => {
  console.log('\nReceived shutdown signal. Starting graceful shutdown...');

  try {
    // Close HTTP server
    await new Promise<void>((resolve) => {
      server.close(() => {
        console.log('✅ HTTP server closed');
        resolve();
      });
    });

    // Close Redis connection
    await checkRedisConnection().then(() => {
      console.log('✅ Redis connection closed');
    }).catch(() => {
      console.warn('⚠️ Redis connection already closed');
    });

    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Set a timeout for forceful shutdown
const forceShutdown = () => {
  console.error('\n❌ Could not close connections in time, forcefully shutting down');
  process.exit(1);
};

// Listen for shutdown signals
process.on('SIGTERM', () => {
  gracefulShutdown();
  setTimeout(forceShutdown, 10000);
});

process.on('SIGINT', () => {
  gracefulShutdown();
  setTimeout(forceShutdown, 10000);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error(error.stack);
  process.exit(1);
});

// Start the server
console.log('\nStarting AI Sales Agent Server...');
startServer().catch((error) => {
  console.error('❌ Failed to start application:', error);
  if (error.stack) console.error(error.stack);
  process.exit(1);
});