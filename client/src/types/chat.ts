export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  audioUrl?: string;
}

export interface ChatStatus {
  connected: boolean;
  typing?: boolean;
  processing?: boolean;
  streaming?: boolean;
  voiceChannel?: {
    active: boolean;
    status: 'connecting' | 'listening' | 'processing' | 'speaking' | 'idle';
  };
}

export interface ChatResponse {
  message: ChatMessage;
  audioUrl?: string;
  error?: string;
}

export interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  url: string | null;
  isStreaming?: boolean;
  streamProgress?: number;
  queueSize?: number;
}

export interface ChatContextType {
  messages: ChatMessage[];
  status: ChatStatus;
  audioState: AudioState;
  isRecording: boolean;
  isMinimized: boolean;
  isVoiceChannelActive: boolean;
  voiceChannelStatus: string;
  sendMessage: (message: string) => Promise<void>;
  startVoiceInput: () => Promise<void>;
  stopVoiceInput: () => Promise<void>;
  cancelVoiceInput: () => void;
  startVoiceChannel: () => Promise<void>;
  stopVoiceChannel: () => Promise<void>;
  playAudio: (url: string) => Promise<void>;
  pauseAudio: () => void;
  minimizeChat: () => void;
  maximizeChat: () => void;
}

export interface SocketOptions {
  path: string;
  transports: string[];
  withCredentials: boolean;
}

export interface ChatConfig {
  wsPath: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  messageRetention: number;
  audioEnabled: boolean;
  voiceInputEnabled: boolean;
  socketOptions: SocketOptions;
}

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

export interface WebSocketEvents {
  [WS_EVENTS.CHAT_MESSAGE]: (message: string) => void;
  [WS_EVENTS.CHAT_RESPONSE]: (response: ChatResponse) => void;
  [WS_EVENTS.CHAT_ERROR]: (error: string) => void;
  [WS_EVENTS.CHAT_STATUS]: (status: ChatStatus) => void;
  [WS_EVENTS.CHAT_TYPING]: (isTyping: boolean) => void;
  [WS_EVENTS.CHAT_START]: () => void;
  [WS_EVENTS.CHAT_AUDIO]: (data: { text: string }) => void;
}

export interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

export const ERROR_CODES = {
  WEBSOCKET_ERROR: 'WEBSOCKET_ERROR',
  AUDIO_ERROR: 'AUDIO_ERROR',
  VOICE_INPUT_ERROR: 'VOICE_INPUT_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];