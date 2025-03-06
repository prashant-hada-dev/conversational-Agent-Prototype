export interface StreamingConfig {
  chunkSize?: number;        // Size of text chunks in characters
  silenceThreshold?: number; // Milliseconds of silence to trigger end of speech
  maxQueueSize?: number;     // Maximum number of audio chunks to queue
}

export interface AudioChunk {
  id: string;
  text: string;
  audio: string;  // Base64 encoded audio data or URL
  isLast: boolean;
  timestamp: number;
}

export interface StreamingError {
  code: 'CHUNK_ERROR' | 'STREAM_ERROR' | 'TTS_ERROR' | 'NETWORK_ERROR';
  message: string;
  details?: unknown;
}

// WebSocket streaming events
export const STREAMING_EVENTS = {
  CHUNK_RECEIVED: 'stream:chunk',
  STREAM_START: 'stream:start',
  STREAM_END: 'stream:end',
  STREAM_ERROR: 'stream:error',
  SPEECH_START: 'speech:start',
  SPEECH_END: 'speech:end',
} as const;

export type StreamingEvent = typeof STREAMING_EVENTS[keyof typeof STREAMING_EVENTS];

// Default configuration
export const DEFAULT_STREAMING_CONFIG: Required<StreamingConfig> = {
  chunkSize: 300,         // 300 characters per chunk
  silenceThreshold: 1500, // 1.5 seconds of silence
  maxQueueSize: 10        // Maximum 10 chunks in queue
};