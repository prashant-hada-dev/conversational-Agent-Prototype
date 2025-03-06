import axios from 'axios';
import FormData from 'form-data';
import config from '../config/config';

class TranscriptionService {
  private readonly apiKey: string;
  private readonly baseUrl: string = 'https://api.openai.com/v1/audio/transcriptions';

  constructor() {
    this.apiKey = config.openaiApiKey;
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required for transcription service');
    }
  }

  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
      console.log('Transcribing audio...');
      
      const formData = new FormData();
      formData.append('file', audioBuffer, {
        filename: 'audio.webm',
        contentType: 'audio/webm',
      });
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');

      const response = await axios.post(this.baseUrl, formData, {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${this.apiKey}`,
        },
        maxBodyLength: Infinity,
      });

      console.log('Transcription response:', response.data);

      if (!response.data.text) {
        throw new Error('No transcription text in response');
      }

      return response.data.text;
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }
}

export const transcriptionService = new TranscriptionService();
export default transcriptionService;