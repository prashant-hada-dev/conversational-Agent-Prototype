import axios from 'axios';
import config from '../config/config';
import { AudioFormat, ERROR_CODES, TTSRequest, TTSResponse } from '../types/chat';

class TTSService {
  private readonly apiKey: string;
  private readonly baseUrl: string = 'https://waves-api.smallest.ai/api/v1/lightning/get_speech';
  private readonly defaultFormat: AudioFormat = 'wav';
  private readonly requestTimeout = 60000; // 60 seconds timeout
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second delay between retries

  // Get values from config
  private readonly defaultVoice: string;
  private readonly defaultSpeed: number;
  private readonly sampleRate: number;
  private readonly enabled: boolean;

  constructor() {
    this.apiKey = config.smallestAiApiKey;
    
    // Initialize from config
    this.defaultVoice = config.tts.defaultVoice;
    this.defaultSpeed = config.tts.defaultSpeed;
    this.sampleRate = config.tts.sampleRate;
    this.enabled = config.tts.enabled;

    if (!this.enabled) {
      console.warn('TTS service disabled: Missing Smallest.ai API key');
    } else {
      console.log(`TTS service initialized with voice: ${this.defaultVoice}, speed: ${this.defaultSpeed}, sample rate: ${this.sampleRate}`);
    }
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'audio/wav'
    };
  }

  // Utility method to clean up text before sending to TTS
  private cleanText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[^\w\s.,!?-]/g, '') // Remove special characters except basic punctuation
      .slice(0, 1000); // Limit text length
  }

  private async makeRequest(requestData: TTSRequest, retryCount = 0): Promise<TTSResponse> {
    if (!this.enabled) {
      throw new Error('TTS service is not enabled');
    }

    try {
      console.log(`Attempting TTS request${retryCount > 0 ? ` (retry ${retryCount}/${this.maxRetries})` : ''}`);
      
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

      // Convert audio buffer to base64
      const audioBase64 = Buffer.from(response.data).toString('base64');
      const audioUrl = `data:audio/wav;base64,${audioBase64}`;

      console.log('TTS request successful');
      return {
        audioUrl,
        duration: 0, // Duration not provided by API
        format: 'wav'
      };
    } catch (error: any) {
      console.error(`TTS Service Error (attempt ${retryCount + 1}/${this.maxRetries + 1}):`, error);

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;

        // Don't retry on these errors
        if (status === 401) {
          throw new Error(`${ERROR_CODES.UNAUTHORIZED}: Invalid API key`);
        }
        if (status === 400) {
          throw new Error(`${ERROR_CODES.INVALID_INPUT}: ${message}`);
        }

        // Retry on timeout, network errors, rate limits, and server errors
        if (
          (error.code === 'ECONNABORTED' ||
           error.code === 'ETIMEDOUT' ||
           status === 429 ||
           status === 500 ||
           status === 503) &&
          retryCount < this.maxRetries
        ) {
          const delay = this.retryDelay * Math.pow(2, retryCount); // Exponential backoff
          console.log(`Retrying TTS request in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.makeRequest(requestData, retryCount + 1);
        }

        // If we've exhausted retries or hit a different error, throw appropriate error
        switch (status) {
          case 429:
            throw new Error(`${ERROR_CODES.RATE_LIMIT}: Rate limit exceeded after retries`);
          case 500:
          case 503:
            throw new Error(`${ERROR_CODES.TTS_SERVICE_ERROR}: Service unavailable after retries`);
          default:
            throw new Error(`${ERROR_CODES.TTS_SERVICE_ERROR}: ${message}`);
        }
      }

      // For non-Axios errors, retry if we haven't hit the limit
      if (retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        console.log(`Retrying TTS request in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(requestData, retryCount + 1);
      }

      throw new Error(`${ERROR_CODES.SERVER_ERROR}: Failed to convert text to speech after retries`);
    }
  }

  async convertToSpeech(
    text: string,
    options: Partial<TTSRequest> = {}
  ): Promise<TTSResponse | null> {
    if (!this.enabled) {
      console.log('TTS service is disabled, skipping audio conversion');
      return null;
    }

    const cleanedText = this.cleanText(text);
    const requestData: TTSRequest = {
      text: cleanedText,
      voice: options.voice || this.defaultVoice,
      format: options.format || this.defaultFormat,
      speed: options.speed || this.defaultSpeed,
    };

    return this.makeRequest(requestData);
  }
}

// Export as singleton
export const ttsService = new TTSService();
export default ttsService;