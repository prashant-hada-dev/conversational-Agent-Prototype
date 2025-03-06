export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private recognition: SpeechRecognition | null = null;

  constructor() {
    if (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';
    }
  }

  async startRecording(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
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

      this.mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          this.audioChunks = [];

          // Stop all tracks
          if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
          }

          // Convert speech to text
          const text = await this.convertSpeechToText(audioBlob);
          resolve({ audioBlob, text });
        } catch (error) {
          reject(error);
        }
      };

      this.mediaRecorder.stop();
    });
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

// Add type declarations for the Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

// Export as singleton
export const audioRecorder = new AudioRecorder();
export default audioRecorder;