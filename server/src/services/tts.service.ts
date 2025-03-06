import axios from 'axios';
import config from '../config/config';
import { AudioFormat, ERROR_CODES, TTSRequest, TTSResponse } from '../types/chat';
import * as fs from 'fs';
import * as path from 'path';

class TTSService {
  private readonly apiKey: string;
  private readonly baseUrl: string = 'https://waves-api.smallest.ai/api/v1/lightning/get_speech';
  private readonly defaultFormat: AudioFormat = 'wav';
  private readonly requestTimeout = 60000; // 1 minute timeout
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second delay between retries
  private readonly maxChunkLength = 150; // Conservative limit for stability

  // Get values from config
  private readonly defaultVoice: string;
  private readonly defaultSpeed: number;
  private readonly sampleRate: number;

  constructor() {
    this.apiKey = config.smallestAiApiKey;
    
    if (!this.apiKey) {
      throw new Error('TTS service requires Smallest.ai API key');
    }
    
    // Initialize from config
    this.defaultVoice = config.tts.defaultVoice;
    this.defaultSpeed = config.tts.defaultSpeed;
    this.sampleRate = config.tts.sampleRate;

    console.log(`TTS service initialized with voice: ${this.defaultVoice}, speed: ${this.defaultSpeed}, sample rate: ${this.sampleRate}`);
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'audio/wav'
    };
  }

  // Split text into smaller chunks for better stability
  private splitTextIntoChunks(text: string): string[] {
    // First clean the text
    const cleanedText = text
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[^\w\s.,!?-]/g, '') // Remove special characters except basic punctuation
      .replace(/\*\*/g, ''); // Remove markdown bold markers

    // Split into sentences, preserving punctuation
    const sentences = cleanedText.match(/[^.!?]+[.!?]+/g) || [cleanedText];
    const chunks: string[] = [];
    let currentChunk = '';

    console.log(`Splitting text into chunks. Total sentences: ${sentences.length}`);

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      
      // If a single sentence is too long, split it by commas
      if (sentence.length > this.maxChunkLength) {
        const subParts = sentence.split(/,/).map(part => part.trim());
        for (const part of subParts) {
          if (part) {
            if ((currentChunk + ' ' + part).length > this.maxChunkLength) {
              if (currentChunk) chunks.push(currentChunk.trim());
              currentChunk = part;
            } else {
              currentChunk = currentChunk ? `${currentChunk}, ${part}` : part;
            }
          }
        }
      } else {
        if ((currentChunk + ' ' + sentence).length > this.maxChunkLength) {
          chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
        }
      }

      // Push the last chunk if this is the last sentence
      if (i === sentences.length - 1 && currentChunk) {
        chunks.push(currentChunk.trim());
      }
    }

    // Log chunks for debugging
    console.log('Created chunks:');
    chunks.forEach((chunk, index) => {
      console.log(`Chunk ${index + 1}/${chunks.length} (${chunk.length} chars): ${chunk}`);
    });

    return chunks;
  }

  private async makeRequest(requestData: TTSRequest, chunkIndex: number, totalChunks: number): Promise<Buffer> {
    let retryCount = 0;
    const maxRetries = this.maxRetries;

    while (retryCount <= maxRetries) {
      try {
        console.log(`Processing chunk ${chunkIndex + 1}/${totalChunks} (${requestData.text.length} chars)`);
        
        const response = await axios.post(
          this.baseUrl,
          {
            text: requestData.text,
            voice_id: requestData.voice || this.defaultVoice,
            sample_rate: this.sampleRate,
            speed: requestData.speed || this.defaultSpeed,
            add_wav_header: true
          },
          {
            headers: this.getHeaders(),
            timeout: this.requestTimeout,
            responseType: 'arraybuffer'
          }
        );

        console.log(`Successfully processed chunk ${chunkIndex + 1}/${totalChunks}`);
        return Buffer.from(response.data);
      } catch (error: any) {
        console.error(`Error processing chunk ${chunkIndex + 1}/${totalChunks} (attempt ${retryCount + 1}/${maxRetries + 1}):`, error);

        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const errorData = error.response?.data;
          let errorMessage = '';

          // Try to parse error message from buffer
          if (errorData instanceof Buffer) {
            try {
              const errorJson = JSON.parse(errorData.toString());
              errorMessage = errorJson.error || '';
            } catch (e) {
              errorMessage = error.message;
            }
          }

          if (status === 401) {
            throw new Error(`${ERROR_CODES.UNAUTHORIZED}: Invalid API key`);
          }
          if (status === 400) {
            throw new Error(`${ERROR_CODES.INVALID_INPUT}: ${errorMessage}`);
          }

          // Retry on specific errors
          if (
            (error.code === 'ECONNABORTED' ||
             error.code === 'ETIMEDOUT' ||
             error.code === 'ERR_BAD_RESPONSE' ||
             error.message?.includes('stream has been aborted') ||
             status === 429 ||
             status === 500 ||
             status === 503) &&
            retryCount < maxRetries
          ) {
            retryCount++;
            const delay = this.retryDelay * Math.pow(2, retryCount - 1);
            console.log(`Retrying chunk ${chunkIndex + 1} in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        throw error;
      }
    }

    throw new Error(`Failed to process chunk ${chunkIndex + 1} after ${maxRetries} retries`);
  }

  async convertToSpeech(
    text: string,
    options: Partial<TTSRequest> = {}
  ): Promise<TTSResponse> {
    console.log('Converting text to speech:', text);

    // Split text into chunks
    const chunks = this.splitTextIntoChunks(text);
    
    try {
      // Process chunks sequentially to maintain voice consistency
      const audioBuffers: Buffer[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const buffer = await this.makeRequest(
          {
            text: chunk,
            voice: options.voice || this.defaultVoice,
            format: options.format || this.defaultFormat,
            speed: options.speed || this.defaultSpeed,
          },
          i,
          chunks.length
        );
        audioBuffers.push(buffer);

        // Small delay between chunks to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Save combined audio
      const timestamp = Date.now();
      const filename = `tts_${timestamp}.wav`;
      const audioDir = path.join(__dirname, '../../audio');
      const filepath = path.join(audioDir, filename);

      // Create directory if needed
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }

      // Combine WAV files
      const combinedBuffer = Buffer.concat(
        audioBuffers.map((buffer, index) => 
          index === 0 ? buffer : buffer.slice(44) // Skip WAV header except for first chunk
        )
      );

      // Save file
      fs.writeFileSync(filepath, combinedBuffer);
      console.log(`Saved combined audio file (${combinedBuffer.length} bytes) to ${filepath}`);

      // Convert to base64 for client
      const audioBase64 = combinedBuffer.toString('base64');
      const audioUrl = `data:audio/wav;base64,${audioBase64}`;

      return {
        audioUrl,
        duration: 0,
        format: 'wav'
      };
    } catch (error) {
      console.error('Failed to convert text to speech:', error);
      throw error;
    }
  }
}

// Export as singleton
export const ttsService = new TTSService();
export default ttsService;