import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../../.env') });

interface Config {
  port: number;
  openaiApiKey: string;
  smallestAiApiKey: string;
  jwtSecret: string;
  redis: {
    host: string;
    port: number;
  };
  wsConfig: {
    pingInterval: number;
    pingTimeout: number;
    path: string;
    authRequired: boolean;
  };
  cors: {
    origin: string;
    credentials: boolean;
  };
  tts: {
    defaultVoice: string;
    defaultSpeed: number;
    sampleRate: number;
    enabled: boolean;
  };
}

const config: Config = {
  port: parseInt(process.env.PORT || '3002', 10),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  smallestAiApiKey: process.env.SMALLEST_AI_API_KEY || '',
  jwtSecret: process.env.JWT_SECRET || 'default_jwt_secret',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  wsConfig: {
    pingInterval: parseInt(process.env.WS_PING_INTERVAL || '30000', 10),
    pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '10000', 10),
    path: '/socket', // Match client's socket path
    authRequired: process.env.WS_AUTH_REQUIRED === 'true',
  },
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? process.env.CLIENT_URL || 'http://localhost:3000'
      : 'http://localhost:3000',
    credentials: true,
  },
  tts: {
    defaultVoice: process.env.TTS_DEFAULT_VOICE || 'jasmine',
    defaultSpeed: parseFloat(process.env.TTS_DEFAULT_SPEED || '1.0'),
    sampleRate: parseInt(process.env.TTS_DEFAULT_SAMPLE_RATE || '16000', 10),
    enabled: Boolean(process.env.SMALLEST_AI_API_KEY),
  },
};

// Validate required configuration
const validateConfig = () => {
  const requiredEnvVars = ['OPENAI_API_KEY', 'JWT_SECRET'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  }
};

validateConfig();

export default config;