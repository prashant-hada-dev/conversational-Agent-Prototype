export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  audioUrl?: string;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  context: string;
  lastActivity: number;
}

export interface ChatResponse {
  message: ChatMessage;
  audioUrl?: string;
  error?: string;
}

export interface WebSocketEvents {
  // Client -> Server events
  'chat:message': (message: string) => void;
  'chat:start': () => void;
  'chat:audio': (audioBlob: Blob) => void;
  'chat:typing': (isTyping: boolean) => void;

  // Server -> Client events
  'chat:response': (response: ChatResponse) => void;
  'chat:error': (error: string) => void;
  'chat:status': (status: {
    connected: boolean;
    typing?: boolean;
    processing?: boolean;
  }) => void;
}

export interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

export type AudioFormat = 'mp3' | 'wav' | 'ogg';

export interface TTSRequest {
  text: string;
  voice?: string;
  format?: AudioFormat;
  speed?: number;
}

export interface TTSResponse {
  audioUrl: string;
  audioPath?: string;  // Path to the audio file on disk
  duration: number;
  format: AudioFormat;
}

// OpenAI Chat Configuration
export interface ChatConfig {
  model: string;
  temperature: number;
  max_tokens: number;
  presence_penalty: number;
  frequency_penalty: number;
  stream?: boolean;
}

// Redis Keys Structure
export const REDIS_KEYS = {
  SESSION_PREFIX: 'chat:session:',
  CONTEXT_PREFIX: 'chat:context:',
  USER_PREFIX: 'user:',
  AUDIO_PREFIX: 'audio:file:',
} as const;

// WebSocket Event Types
export const WS_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CHAT_MESSAGE: 'chat:message',
  CHAT_RESPONSE: 'chat:response',
  CHAT_ERROR: 'chat:error',
  CHAT_STATUS: 'chat:status',
  CHAT_TYPING: 'chat:typing',
  CHAT_START: 'chat:start',
  CHAT_AUDIO: 'chat:audio',
} as const;

// Error Codes
export const ERROR_CODES = {
  INVALID_INPUT: 'INVALID_INPUT',
  SERVER_ERROR: 'SERVER_ERROR',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  TTS_SERVICE_ERROR: 'TTS_SERVICE_ERROR',
  REDIS_ERROR: 'REDIS_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMIT: 'RATE_LIMIT',
} as const;