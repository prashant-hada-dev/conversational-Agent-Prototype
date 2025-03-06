import socketIOClient from 'socket.io-client';
import { ChatConfig, ChatResponse, ChatStatus, WebSocketEvents, WS_EVENTS } from '../types/chat';

class WebSocketService {
  private socket: ReturnType<typeof socketIOClient> | null = null;
  private reconnectAttempts = 0;
  private config: ChatConfig;

  constructor(config: ChatConfig) {
    this.config = config;
    console.log('WebSocket Service initialized with config:', config);
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const serverUrl = this.config.wsPath.startsWith('http')
          ? this.config.wsPath
          : import.meta.env.VITE_API_URL;

        console.log('Attempting to connect to WebSocket server:', serverUrl);
        
        this.socket = socketIOClient(serverUrl, {
          path: this.config.socketOptions.path,
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: this.config.maxReconnectAttempts,
          reconnectionDelay: this.config.reconnectInterval,
          timeout: 10000,
        });

        // Set up event listeners
        this.setupEventListeners();

        this.socket.on('connect', () => {
          console.log('WebSocket connected successfully');
          this.reconnectAttempts = 0;
          resolve();
        });

        this.socket.on('connect_error', (error: Error) => {
          console.error('WebSocket connection error:', error);
          this.handleReconnect(reject);
        });

        this.socket.on('disconnect', (reason: string) => {
          console.log('WebSocket disconnected:', reason);
          if (reason === 'io server disconnect' || reason === 'transport close') {
            this.handleReconnect(reject);
          }
        });

      } catch (error) {
        console.error('WebSocket initialization error:', error);
        reject(error);
      }
    });
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Remove any existing listeners to prevent duplicates
    this.removeAllListeners();

    // Set up message handler
    this.socket.on(WS_EVENTS.CHAT_RESPONSE, (response: ChatResponse) => {
      console.log('Received message:', response);
      this.messageCallback?.(response);
    });

    // Set up error handler
    this.socket.on(WS_EVENTS.CHAT_ERROR, (error: string) => {
      console.error('WebSocket error:', error);
      this.errorCallback?.(error);
    });

    // Set up status handler
    this.socket.on(WS_EVENTS.CHAT_STATUS, (status: ChatStatus) => {
      this.statusCallback?.(status);
    });
  }

  private messageCallback?: (response: ChatResponse) => void;
  private errorCallback?: (error: string) => void;
  private statusCallback?: (status: ChatStatus) => void;

  private handleReconnect(reject: (reason?: any) => void): void {
    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);
    
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      reject(new Error('Max reconnection attempts reached'));
      return;
    }

    // Attempt to reconnect
    setTimeout(() => {
      console.log('Attempting reconnection...');
      if (this.socket) {
        this.socket.connect();
      } else {
        this.connect().catch(console.error);
      }
    }, this.config.reconnectInterval);
  }

  disconnect(): void {
    if (this.socket) {
      console.log('Disconnecting WebSocket');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  sendMessage(message: string): void {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected');
    }
    console.log('Sending message:', message);
    this.socket.emit(WS_EVENTS.CHAT_MESSAGE, message);
  }

  sendAudio(data: { text: string }): void {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected');
    }
    console.log('Sending transcribed audio:', data.text);
    this.socket.emit(WS_EVENTS.CHAT_AUDIO, data);
  }

  setTypingStatus(isTyping: boolean): void {
    if (!this.socket?.connected) return;
    this.socket.emit(WS_EVENTS.CHAT_TYPING, isTyping);
  }

  onMessage(callback: (response: ChatResponse) => void): void {
    this.messageCallback = callback;
    if (this.socket?.connected) {
      this.setupEventListeners();
    }
  }

  onError(callback: (error: string) => void): void {
    this.errorCallback = callback;
    if (this.socket?.connected) {
      this.setupEventListeners();
    }
  }

  onStatus(callback: (status: ChatStatus) => void): void {
    this.statusCallback = callback;
    if (this.socket?.connected) {
      this.setupEventListeners();
    }
  }

  onDisconnect(callback: () => void): void {
    if (this.socket?.connected) {
      this.socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
        this.handleReconnect(() => {});
        callback();
      });
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  removeAllListeners(): void {
    if (this.socket) {
      console.log('Removing all WebSocket listeners');
      this.socket.removeAllListeners();
    }
  }

  removeListener(event: keyof WebSocketEvents): void {
    if (this.socket) {
      console.log('Removing listener for event:', event);
      this.socket.off(event);
    }
  }
}

export default WebSocketService;