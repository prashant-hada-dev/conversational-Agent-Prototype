import { AudioChunk, ProcessedAudioChunk, AudioQueueState, StreamingConfig, StreamingError, DEFAULT_STREAMING_CONFIG } from '../types/streaming';
import { urlToBlob } from '../utils/audio';

class AudioQueueManager {
  private audioContext: AudioContext | null = null;
  private queue: ProcessedAudioChunk[] = [];
  private isPlaying: boolean = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private config: StreamingConfig;
  private onStateChange?: (state: AudioQueueState) => void;
  private onError?: (error: StreamingError) => void;

  constructor(config: Partial<StreamingConfig> = {}) {
    this.config = { ...DEFAULT_STREAMING_CONFIG, ...config };
    this.initAudioContext();
  }

  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
      this.handleError({
        code: 'PLAYBACK_ERROR',
        message: 'Failed to initialize audio system',
        details: error
      });
    }
  }

  async enqueueChunk(chunk: AudioChunk): Promise<void> {
    try {
      if (this.queue.length >= this.config.maxQueueSize) {
        throw new Error('Audio queue is full');
      }

      // Check for duplicate chunks
      const isDuplicate = this.queue.some(queuedChunk => queuedChunk.id === chunk.id);
      if (isDuplicate) {
        console.log(`Skipping duplicate chunk: ${chunk.id}`);
        return;
      }

      // Process the chunk if audio is a string URL
      let processedChunk: ProcessedAudioChunk;
      if (typeof chunk.audio === 'string') {
        const audioBlob = await urlToBlob(chunk.audio);
        processedChunk = {
          ...chunk,
          audio: audioBlob
        };
      } else {
        processedChunk = chunk as ProcessedAudioChunk;
      }

      // Log chunk details before enqueueing
      console.log('Enqueueing chunk:', {
        id: chunk.id,
        isLast: chunk.isLast,
        queueSize: this.queue.length,
        isPlaying: this.isPlaying
      });

      this.queue.push(processedChunk);

      // If not playing, start playback
      if (!this.isPlaying) {
        await this.startPlayback();
      }

      this.updateState();
    } catch (error) {
      this.handleError({
        code: 'QUEUE_FULL',
        message: 'Failed to enqueue audio chunk',
        details: error
      });
    }
  }

  private async startPlayback(): Promise<void> {
    if (!this.audioContext || this.isPlaying || this.queue.length === 0) return;

    this.isPlaying = true;
    await this.playNextChunk();
  }

  private async playNextChunk(): Promise<void> {
    if (!this.audioContext || !this.isPlaying || this.queue.length === 0) {
      this.isPlaying = false;
      this.updateState();
      return;
    }

    try {
      const chunk = this.queue[0];
      
      // Log before playing
      console.log('Starting playback of chunk:', {
        id: chunk.id,
        isLast: chunk.isLast,
        queueSize: this.queue.length
      });

      const audioBuffer = await this.createAudioBuffer(chunk);
      
      // Ensure we're not already playing something
      if (this.currentSource) {
        console.log('Stopping current source before playing new chunk');
        this.currentSource.stop();
        this.currentSource = null;
      }

      this.currentSource = this.audioContext.createBufferSource();
      this.currentSource.buffer = audioBuffer;
      this.currentSource.connect(this.audioContext.destination);

      // Handle chunk completion
      this.currentSource.onended = () => {
        console.log(`Chunk ${chunk.id} playback ended`);
        
        // Only remove the chunk if it's still at the front of the queue
        if (this.queue[0]?.id === chunk.id) {
          this.queue.shift(); // Remove played chunk
          console.log(`Removed chunk ${chunk.id}, queue size: ${this.queue.length}`);
        }
        
        this.currentSource = null;
        
        if (this.queue.length > 0) {
          console.log('Playing next chunk in queue');
          this.playNextChunk(); // Play next chunk
        } else {
          console.log('No more chunks in queue');
          this.isPlaying = false;
        }
        this.updateState();
      };

      this.currentSource.start(0);
      this.updateState();

      // Log playback progress
      console.log(`Playing chunk ${chunk.id}, ${this.queue.length} chunks remaining`);

    } catch (error) {
      console.error(`Error playing chunk:`, error);
      this.handleError({
        code: 'PLAYBACK_ERROR',
        message: 'Failed to play audio chunk',
        details: error
      });
      this.queue.shift(); // Remove problematic chunk
      this.playNextChunk(); // Try next chunk
    }
  }

  private async createAudioBuffer(chunk: ProcessedAudioChunk): Promise<AudioBuffer> {
    try {
      const arrayBuffer = await chunk.audio.arrayBuffer();
      return await this.audioContext!.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error(`Failed to create audio buffer for chunk ${chunk.id}:`, error);
      throw new Error(`Audio processing failed: ${error}`);
    }
  }

  private updateState(): void {
    if (!this.onStateChange) return;

    const currentChunk = this.queue[0];
    const state: AudioQueueState = {
      isPlaying: this.isPlaying,
      isPaused: this.audioContext?.state === 'suspended',
      currentChunkId: currentChunk?.id || null,
      remainingChunks: this.queue.length
    };

    this.onStateChange(state);
  }

  private handleError(error: StreamingError): void {
    console.error('AudioQueueManager error:', error);
    this.onError?.(error);
  }

  // Public control methods
  pause(): void {
    if (this.audioContext?.state === 'running') {
      this.audioContext.suspend();
      this.updateState();
    }
  }

  resume(): void {
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
      this.updateState();
    }
  }

  stop(): void {
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }
    this.queue = [];
    this.isPlaying = false;
    this.updateState();
  }

  clear(): void {
    this.stop();
    this.queue = [];
    this.updateState();
  }

  // Event handlers
  onQueueStateChange(callback: (state: AudioQueueState) => void): void {
    this.onStateChange = callback;
  }

  onQueueError(callback: (error: StreamingError) => void): void {
    this.onError = callback;
  }
}

// Add type declarations for Web Audio API
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

// Export as singleton
export const audioQueueManager = new AudioQueueManager();
export default audioQueueManager;