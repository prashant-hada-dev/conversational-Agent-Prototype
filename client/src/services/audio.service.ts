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
  private onSilenceDetected?: (isSilent: boolean) => void;
  private lastAudioLevel: number = 0;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private isListening: boolean = false;
  private hasDetectedSpeech: boolean = false;
  private minSpeechLength: number = 500; // Minimum speech duration to consider it valid
  private speechStartTime: number | null = null;

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

  private async setupAudioAnalysis(stream: MediaStream): Promise<void> {
    console.log('Setting up audio analysis...');
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log('Audio context created:', this.audioContext.state);

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      console.log('Analyzer created, FFT size:', this.analyser.fftSize);
      
      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.analyser);
      console.log('Audio source connected to analyzer');
      
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      console.log('Data array initialized, size:', this.dataArray.length);

      // Resume audio context if suspended
      if (!this.audioContext) {
        throw new Error('Audio context not initialized');
      }

      if (this.audioContext.state === 'suspended') {
        console.log('Resuming audio context...');
        await this.audioContext.resume();
        console.log('Audio context resumed:', this.audioContext.state);
      }

      this.startSilenceDetection();
    } catch (error) {
      console.error('Error in setupAudioAnalysis:', error);
    }
  }

  private startSilenceDetection(): void {
    if (!this.analyser || !this.dataArray) {
      console.debug('Audio analysis not initialized');
      return;
    }

    const checkSilence = (): void => {
      if (!this.isListening || this.mediaRecorder?.state !== 'recording') {
        console.debug('Silence detection skipped - not recording');
        return;
      }

      try {
        // These were checked at the start of the function
        const analyser = this.analyser!;
        const dataArray = this.dataArray!;

        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        
        // Initialize lastAudioLevel if not set
        if (this.lastAudioLevel === 0) {
          this.lastAudioLevel = average;
          console.debug('Initial audio level:', average.toFixed(1));
        }

        // More sensitive silence detection with dynamic thresholds
        const silenceThreshold = Math.max(6, this.lastAudioLevel * 0.15); // Lower base threshold
        const speechThreshold = silenceThreshold * 1.8; // Higher threshold for confirming speech
        const isSilent = average < silenceThreshold;
        const silenceTime = this.config.silenceThreshold;
        const minSilenceDuration = this.hasDetectedSpeech ? 400 : 800; // Faster response after speech detected
        
        // Log to browser console
        console.debug(
          `🎤 Audio Levels:\n` +
          `  Current: ${average.toFixed(1)}\n` +
          `  Baseline: ${this.lastAudioLevel.toFixed(1)}\n` +
          `  Threshold: ${silenceThreshold.toFixed(1)}\n` +
          `  Silent: ${isSilent ? '🔇' : '🔊'}`
        );

        // Notify UI about silence state change
        this.onSilenceDetected?.(isSilent);

        // Track if we've detected actual speech (using the speech threshold)
        const hasSpeech = average > speechThreshold;
        
        if (hasSpeech) {
          if (!this.hasDetectedSpeech) {
            console.log('🗣️ Speech started:', {
              level: average.toFixed(1),
              threshold: speechThreshold.toFixed(1)
            });
            this.hasDetectedSpeech = true;
            this.speechStartTime = Date.now();
          }
          // Reset silence timer if it exists
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
        }

        if (isSilent && this.hasDetectedSpeech) {
          const speechDuration = this.speechStartTime ? Date.now() - this.speechStartTime : 0;
          
          if (!this.silenceTimer && speechDuration >= this.minSpeechLength) {
            console.log('🔇 Silence detected after valid speech:', {
              speechDuration,
              minRequired: this.minSpeechLength
            });
            this.silenceTimer = setTimeout(() => {
              if (this.isListening && this.mediaRecorder?.state === 'recording') {
                console.log('⏹️ Auto-processing voice input');
                this.stopRecording().catch((error: Error) => {
                  console.error('Failed to stop recording:', error);
                });
              }
            }, Math.max(minSilenceDuration, silenceTime * 0.5)); // Quick response after speech
          }
        } else {
          // Update baseline audio level with decay
          this.lastAudioLevel = this.lastAudioLevel === 0
            ? average
            : average * 0.3 + this.lastAudioLevel * 0.7;
          
          if (this.silenceTimer) {
            console.log('🔊 Sound detected, resetting silence timer');
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
        }

        // Continue monitoring
        requestAnimationFrame(checkSilence);
      } catch (error) {
        console.error('Error in silence detection:', error);
        // Continue monitoring despite error
        requestAnimationFrame(checkSilence);
      }
    };

    this.isListening = true;
    checkSilence();
  }

  public async startRecording(): Promise<void> {
    try {
      // Only get new stream and setup analysis if we don't have them
      if (!this.stream || !this.audioContext) {
        console.log('Setting up new audio resources...');
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        await this.setupAudioAnalysis(this.stream);
      } else {
        console.log('Reusing existing audio resources');
      }

      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioChunks = [];
      this.isListening = true;
      
      // Reset all speech detection state
      this.hasDetectedSpeech = false;
      this.speechStartTime = null;
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
      this.lastAudioLevel = 0;

      console.log('🎙️ Voice detection reset and ready');

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log(`Recorded chunk: ${event.data.size} bytes`);
        }
      };

      this.mediaRecorder.start(1000); // Record in 1-second chunks
      this.onSpeechStart?.();
      console.log('🎙️ Recording started with silence detection');

      // Reset audio levels for new recording
      this.lastAudioLevel = 0;
    } catch (error) {
      console.error('Error starting recording:', error);
      throw new Error('Failed to start recording');
    }
  }

  public async stopRecording(): Promise<{ audioBlob: Blob; text: string }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No recording in progress'));
        return;
      }

      // Keep isListening true if we're in continuous mode
      const wasListening = this.isListening;
      
      // Clear any pending silence timer
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }

      // Temporarily set isListening to false to prevent silence detection during processing
      this.isListening = false;

      this.mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          this.audioChunks = [];

          // Only clean up resources if we're not going to restart recording
          if (!this.isListening) {
            console.log('Cleaning up audio resources...');
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
          }

          // Convert speech to text
          const text = await this.convertSpeechToText(audioBlob);

          // Signal speech end and resolve
          this.onSpeechEnd?.();
          console.log('Recording stopped, speech end signaled');
          resolve({ audioBlob, text });

          // If we were listening before (voice channel active), restart recording
          if (wasListening) {
            console.log('Voice channel active, auto-restarting recording...');
            
            // Restore listening state
            this.isListening = true;
            
            // Immediate restart to not miss any speech
            this.startRecording().catch(error => {
              console.error('Failed to restart recording:', error);
              this.isListening = false; // Reset state on error
            });
          }
        } catch (error) {
          console.error('Error in stopRecording:', error);
          reject(error);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  // Event handlers for speech detection
  public setOnSpeechStart(callback: () => void): void {
    this.onSpeechStart = callback;
  }

  public setOnSpeechEnd(callback: () => void): void {
    this.onSpeechEnd = callback;
  }

  public setOnSilenceDetected(callback: (isSilent: boolean) => void): void {
    this.onSilenceDetected = callback;
  }

  public isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  public cancelRecording(): void {
    if (this.mediaRecorder?.state === 'recording') {
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
      } catch (error: unknown) {
        console.warn('Error aborting recognition:', error);
      }
    }
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