import { ttsService } from './tts.service';
import { StreamingConfig } from '../types/streaming';
import { Server as SocketServer } from 'socket.io';
import { AudioChunk } from '../types/streaming';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

class StreamingTTSService {
  private io: SocketServer | null = null;
  private readonly chunkSize = 300; // characters per chunk

  async generateAudio(text: string, outputPath: string): Promise<void> {
    try {
      const result = await ttsService.convertToSpeech(text);
      
      // Move the generated file to the desired location
      if (result.audioPath) {
        const audioDir = path.dirname(outputPath);
        if (!fs.existsSync(audioDir)) {
          await fs.promises.mkdir(audioDir, { recursive: true });
        }
        await fs.promises.rename(result.audioPath, outputPath);
        console.log(`Generated audio file saved to: ${outputPath}`);
      }
    } catch (error) {
      console.error('Error generating audio:', error);
      throw error;
    }
  }

  setSocketServer(io: SocketServer) {
    this.io = io;
  }

  private splitTextIntoChunks(text: string): string[] {
    // If text is shorter than chunk size, return as single chunk
    if (text.length <= this.chunkSize) {
      return [text];
    }

    const words = text.split(' ');
    const chunks: string[] = [];
    let currentChunk = '';

    for (const word of words) {
      const potentialChunk = currentChunk ? `${currentChunk} ${word}` : word;
      
      // If adding this word would exceed chunk size
      if (potentialChunk.length > this.chunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = word;
        } else {
          // Handle case where single word exceeds chunk size
          const wordChunks = word.match(new RegExp(`.{1,${this.chunkSize}}`, 'g')) || [];
          chunks.push(...wordChunks);
        }
      } else {
        currentChunk = potentialChunk;
      }
    }

    // Add the last chunk if any
    if (currentChunk) {
      // If the last chunk is very small, combine with previous
      if (chunks.length > 0 && currentChunk.length < this.chunkSize * 0.3) {
        const lastChunk = chunks.pop()!;
        const combined = `${lastChunk} ${currentChunk}`;
        if (combined.length <= this.chunkSize) {
          chunks.push(combined);
        } else {
          chunks.push(lastChunk, currentChunk);
        }
      } else {
        chunks.push(currentChunk);
      }
    }

    return chunks;
  }

  private activeStreams: Set<string> = new Set();

  async streamResponse(
    socket: any,
    text: string,
    config?: StreamingConfig
  ): Promise<void> {
    if (!this.io) {
      throw new Error('Socket server not initialized');
    }

    const streamId = uuidv4();
    if (this.activeStreams.has(socket.id)) {
      console.log(`Canceling existing stream for socket ${socket.id}`);
      socket.emit('stream:error', {
        code: 'STREAM_ERROR',
        message: 'Previous stream was canceled due to new request'
      });
    }

    this.activeStreams.add(socket.id);
    const audioFiles: string[] = [];

    try {
      // Signal stream start
      socket.emit('stream:start');

      // Split text into chunks
      const chunks = this.splitTextIntoChunks(text);
      console.log(`Text chunking details for stream ${streamId}:`, {
        originalLength: text.length,
        chunks: chunks.map(chunk => ({
          length: chunk.length,
          text: chunk.length > 50 ? `${chunk.slice(0, 50)}...` : chunk
        })),
        totalChunks: chunks.length
      });

      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        // Check if stream was canceled
        if (!this.activeStreams.has(socket.id)) {
          console.log(`Stream ${streamId} was canceled`);
          return;
        }

        const chunk = chunks[i];
        const isLast = i === chunks.length - 1;

        try {
          // Convert chunk to audio
          const { audioUrl, audioPath } = await ttsService.convertToSpeech(chunk);
          if (audioPath) audioFiles.push(audioPath);

          // Create chunk response
          const audioChunk: AudioChunk = {
            id: `${streamId}-${i}`,
            text: chunk,
            audio: audioUrl,
            isLast,
            timestamp: Date.now()
          };

          // Send chunk to client
          socket.emit('stream:chunk', audioChunk);
          console.log(`Sent chunk ${i + 1}/${chunks.length} (${chunk.length} chars) for stream ${streamId}`);

          // Small delay between chunks
          if (!isLast) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`Error processing chunk ${i + 1} for stream ${streamId}:`, error);
          socket.emit('stream:error', {
            code: 'CHUNK_ERROR',
            message: `Failed to process chunk ${i + 1}`,
            details: error
          });
        }
      }

      // Signal stream end
      socket.emit('stream:end');
      console.log(`Stream ${streamId} completed successfully`);

    } catch (error) {
      console.error(`Streaming error for stream ${streamId}:`, error);
      socket.emit('stream:error', {
        code: 'STREAM_ERROR',
        message: 'Failed to process streaming response',
        details: error
      });
    } finally {
      // Cleanup
      this.activeStreams.delete(socket.id);
      this.cleanupAudioFiles(audioFiles);
    }
  }

  private async cleanupAudioFiles(files: string[]): Promise<void> {
    for (const file of files) {
      try {
        await fs.promises.unlink(file);
        console.log(`Cleaned up audio file: ${file}`);
      } catch (error) {
        console.error(`Failed to cleanup audio file ${file}:`, error);
      }
    }
  }
}

// Export as singleton
export const streamingTTSService = new StreamingTTSService();
export default streamingTTSService;