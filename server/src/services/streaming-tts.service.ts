import { ttsService } from './tts.service';
import { StreamingConfig } from '../types/streaming';
import { Server as SocketServer } from 'socket.io';
import { AudioChunk } from '../types/streaming';
import { v4 as uuidv4 } from 'uuid';

class StreamingTTSService {
  private io: SocketServer | null = null;
  private readonly chunkSize = 300; // characters per chunk

  setSocketServer(io: SocketServer) {
    this.io = io;
  }

  private splitTextIntoChunks(text: string): string[] {
    const words = text.split(' ');
    const chunks: string[] = [];
    let currentChunk = '';

    for (const word of words) {
      const potentialChunk = currentChunk ? `${currentChunk} ${word}` : word;
      
      if (potentialChunk.length > this.chunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = word;
        } else {
          // If a single word is longer than chunk size, split it
          chunks.push(word);
        }
      } else {
        currentChunk = potentialChunk;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  async streamResponse(
    socket: any,
    text: string,
    config?: StreamingConfig
  ): Promise<void> {
    if (!this.io) {
      throw new Error('Socket server not initialized');
    }

    try {
      // Signal stream start
      socket.emit('stream:start');

      // Split text into chunks
      const chunks = this.splitTextIntoChunks(text);
      console.log(`Split response into ${chunks.length} chunks`);

      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const isLast = i === chunks.length - 1;

        try {
          // Convert chunk to audio
          const { audioUrl } = await ttsService.convertToSpeech(chunk);

          // Create chunk response
          const audioChunk: AudioChunk = {
            id: uuidv4(),
            text: chunk,
            audio: audioUrl,
            isLast,
            timestamp: Date.now()
          };

          // Send chunk to client
          socket.emit('stream:chunk', audioChunk);
          console.log(`Sent chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);

          // Small delay between chunks to avoid overwhelming the client
          if (!isLast) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`Error processing chunk ${i + 1}:`, error);
          socket.emit('stream:error', {
            code: 'CHUNK_ERROR',
            message: `Failed to process chunk ${i + 1}`,
            details: error
          });
        }
      }

      // Signal stream end
      socket.emit('stream:end');
      console.log('Streaming completed successfully');

    } catch (error) {
      console.error('Streaming error:', error);
      socket.emit('stream:error', {
        code: 'STREAM_ERROR',
        message: 'Failed to process streaming response',
        details: error
      });
    }
  }
}

// Export as singleton
export const streamingTTSService = new StreamingTTSService();
export default streamingTTSService;