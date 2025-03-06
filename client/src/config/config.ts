import { ChatConfig } from '../types/chat';

const config: {
  ws: ChatConfig;
  api: {
    baseUrl: string;
  };
} = {
  ws: {
    wsPath: import.meta.env.VITE_API_URL || 'http://localhost:3002',
    reconnectInterval: Number(import.meta.env.VITE_WS_RECONNECT_INTERVAL) || 5000,
    maxReconnectAttempts: Number(import.meta.env.VITE_WS_MAX_RECONNECT_ATTEMPTS) || 5,
    messageRetention: 50,
    audioEnabled: true,
    voiceInputEnabled: true,
    socketOptions: {
      path: import.meta.env.VITE_WS_PATH || '/socket',
      transports: ['websocket'],
      withCredentials: true,
    }
  },
  api: {
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3002',
  },
};

export default config;