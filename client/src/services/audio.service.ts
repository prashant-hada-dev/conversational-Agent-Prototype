import { StreamingConfig, DEFAULT_STREAMING_CONFIG } from '../types/streaming';

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private recognition: SpeechRecognition | null = null;
  private silenceTimer: NodeJS.Timeout | null = null;
  private config: StreamingConfig;
  private onSpeechStart?: () => void;
  private onSpeechEnd?: () => void;
  private lastAudioLevel: number = 0;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private isListening: boolean = false;

  constructor(config: Partial<StreamingConfig> = {}) {
    this.config = { ...DEFAULT_STREAMING_CONFIG, ...config };

    if (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
    }
  }

  private setupAudioAnalysis(stream: MediaStream): void {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    
    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.analyser);
    
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.startSilenceDetection();
  }

  private startSilenceDetection(): void {
    if (!this.analyser || !this.dataArray) return;

    const checkSilence = () => {
      if (!this.isListening) return;
      
      this.analyser!.getByteFrequencyData(this.dataArray!);
      const average = this.dataArray!.reduce((a, b) => a + b) / this.dataArray!.length;
      
      if (average < 10) { // Silence threshold
        if (!this.silenceTimer) {
          this.silenceTimer = setTimeout(() => {
            if (this.isListening) {
              this.stopRecording();
            }
          }, this.config.silenceThreshold);
        }
      } else {
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
      }

      if (this.isListening) {
        requestAnimationFrame(checkSilence);
      }
    };

    this.isListening = true;
    checkSilence();
  }

  async startRecording(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioChunks = [];
      this.isListening = true;

      // Set up audio analysis for silence detection
      this.setupAudioAnalysis(this.stream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(1000); // Record in 1-second chunks
      this.onSpeechStart?.();
      console.log('Recording started with silence detection');
    } catch (error) {
      console.error('Error starting recording:', error);
      throw new Error('Failed to start recording');
    }
  }

  async stopRecording(): Promise<{ audioBlob: Blob; text: string }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No recording in progress'));
        return;
      }

      this.isListening = false;
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          this.audioChunks = [];

          // Clean up audio analysis
          if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
            this.analyser = null;
            this.dataArray = null;
          }

          // Stop all tracks
          if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
          }

          // Signal speech end
          this.onSpeechEnd?.();
          console.log('Recording stopped, speech end signaled');

          // Convert speech to text
          const text = await this.convertSpeechToText(audioBlob);
          resolve({ audioBlob, text });
        } catch (error) {
          console.error('Error in stopRecording:', error);
          reject(error);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  // Event handlers for speech detection
  setOnSpeechStart(callback: () => void): void {
    this.onSpeechStart = callback;
  }

  setOnSpeechEnd(callback: () => void): void {
    this.onSpeechEnd = callback;
  }

  private async convertSpeechToText(audioBlob: Blob): Promise<string> {
    console.log('Converting speech to text from blob:', {
      type: audioBlob.type,
      size: audioBlob.size
    });
    
    try {
      // Create form data
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      // Get API URL from environment
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const transcribeUrl = `${apiUrl}/api/transcribe`;
      
      console.log('Sending audio to transcription service:', transcribeUrl);

      // Send to server for transcription
      const response = await fetch(transcribeUrl, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Transcription failed: ${response.statusText}${
            errorData.error ? ` - ${errorData.error}` : ''
          }`
        );
      }

      const result = await response.json();
      console.log('Transcription result:', result);

      if (!result.text) {
        throw new Error('No text was transcribed');
      }

      return result.text.trim();
    } catch (error) {
      console.error('Transcription error:', error);
      throw new Error(
        error instanceof Error
          ? error.message
          : 'Failed to transcribe audio'
      );
    }
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      this.audioChunks = [];
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (error) {
        console.warn('Error aborting recognition:', error);
      }
    }
  }
}

// Add type declarations for Web APIs
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
  }

  interface AudioContext {
    createMediaStreamSource(stream: MediaStream): MediaStreamAudioSourceNode;
  }

  interface AnalyserNode {
    getByteFrequencyData(array: Uint8Array): void;
    readonly frequencyBinCount: number;
    fftSize: number;
  }
}

// Export as singleton
export const audioRecorder = new AudioRecorder();
export default audioRecorder;