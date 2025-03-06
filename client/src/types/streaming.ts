export interface AudioChunk {
  id: string;
  text: string;
  audio: Blob | string;  // Can be either a Blob or a URL/base64 string
  isLast: boolean;
  timestamp: number;
}

export interface ProcessedAudioChunk extends Omit<AudioChunk, 'audio'> {
  audio: Blob;  // Guaranteed to be a Blob after processing
}

export interface StreamingConfig {
  silenceThreshold: number;  // milliseconds of silence to trigger end of speech
  chunkSize: number;        // character count for text chunks
  maxQueueSize: number;     // maximum number of audio chunks to queue
}

export interface AudioQueueState {
  isPlaying: boolean;
  isPaused: boolean;
  currentChunkId: string | null;
  remainingChunks: number;
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

export interface StreamingError {
  code: 'CHUNK_ERROR' | 'QUEUE_FULL' | 'PLAYBACK_ERROR' | 'NETWORK_ERROR';
  message: string;
  details?: unknown;
}

// Default configuration
export const DEFAULT_STREAMING_CONFIG: StreamingConfig = {
  silenceThreshold: 1500,  // 1.5 seconds of silence
  chunkSize: 300,         // 300 characters per chunk
  maxQueueSize: 10        // Maximum 10 chunks in queue
};