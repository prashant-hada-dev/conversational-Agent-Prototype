import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/config';
import { ChatMessage, ChatResponse, WebSocketEvents, WS_EVENTS, ErrorResponse } from '../types/chat';
import { STREAMING_EVENTS, StreamingError } from '../types/streaming';
import { aiService } from './ai.service';
import { redisService } from './redis.service';
import { streamingTTSService } from './streaming-tts.service';

class WebSocketService {
  private io: SocketIOServer;
  private activeConnections: Map<string, Socket> = new Map();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      path: config.wsConfig.path,
      pingInterval: config.wsConfig.pingInterval,
      pingTimeout: config.wsConfig.pingTimeout,
      cors: {
        origin: config.cors.origin,
        methods: ['GET', 'POST'],
        credentials: config.cors.credentials
      }
    });

    // Initialize streaming TTS service with socket server
    streamingTTSService.setSocketServer(this.io);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);
      this.activeConnections.set(socket.id, socket);

      // Initialize session
      const sessionId = uuidv4();
      socket.data.sessionId = sessionId;

      // Handle chat message
      socket.on(WS_EVENTS.CHAT_MESSAGE, async (message: string) => {
        try {
          await this.handleChatMessage(socket, message);
        } catch (error) {
          this.handleError(socket, error);
        }
      });

      // Handle audio input
      socket.on(WS_EVENTS.CHAT_AUDIO, async (data: { text: string }) => {
        try {
          await this.handleChatMessage(socket, data.text);
        } catch (error) {
          this.handleError(socket, error);
        }
      });

      // Handle speech events
      socket.on(STREAMING_EVENTS.SPEECH_START, () => {
        console.log(`Speech started: ${socket.id}`);
        socket.broadcast.emit(STREAMING_EVENTS.SPEECH_START);
      });

      socket.on(STREAMING_EVENTS.SPEECH_END, () => {
        console.log(`Speech ended: ${socket.id}`);
        socket.broadcast.emit(STREAMING_EVENTS.SPEECH_END);
      });

      // Handle typing indicator
      socket.on(WS_EVENTS.CHAT_TYPING, (isTyping: boolean) => {
        socket.broadcast.emit(WS_EVENTS.CHAT_STATUS, {
          connected: true,
          typing: isTyping
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        this.activeConnections.delete(socket.id);
      });
    });
  }

  private async handleChatMessage(socket: Socket, message: string): Promise<void> {
    const sessionId = socket.data.sessionId;

    // Emit typing indicator
    socket.emit(WS_EVENTS.CHAT_STATUS, {
      connected: true,
      processing: true
    });

    try {
      // Save user message
      const userMessage: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: message,
        timestamp: Date.now()
      };
      await redisService.addMessageToSession(sessionId, userMessage);

      // Generate AI response
      let lastContent = '';
      let lastMessageId = '';
      const aiResponse = await aiService.generateStreamingResponse(
        sessionId,
        message,
        (token: string) => {
          lastContent += token;
          if (!lastMessageId) {
            lastMessageId = 'stream-' + Date.now();
          }
          socket.emit(WS_EVENTS.CHAT_RESPONSE, {
            message: {
              id: lastMessageId,
              role: 'assistant',
              content: lastContent,
              timestamp: Date.now()
            }
          });
        }
      );

      // Stream TTS response
      await streamingTTSService.streamResponse(socket, aiResponse.content);

      // Save final message to Redis
      const finalMessage: ChatMessage = {
        ...aiResponse,
        id: lastMessageId || uuidv4()
      };
      await redisService.addMessageToSession(sessionId, finalMessage);

    } catch (error) {
      this.handleError(socket, error);
    } finally {
      socket.emit(WS_EVENTS.CHAT_STATUS, {
        connected: true,
        processing: false
      });
    }
  }

  private handleError(socket: Socket, error: unknown): void {
    console.error('WebSocket Error:', error);
    
    const errorResponse: ErrorResponse | StreamingError = {
      error: 'An error occurred',
      code: 'UNKNOWN_ERROR'
    };

    if (typeof error === 'string') {
      errorResponse.error = error;
    } else if (error && typeof error === 'object') {
      if ('error' in error && typeof error.error === 'string') {
        errorResponse.error = error.error;
      }
      if ('code' in error && typeof error.code === 'string') {
        errorResponse.code = error.code;
      }
      if ('details' in error) {
        errorResponse.details = error.details;
      }
    }

    socket.emit(WS_EVENTS.CHAT_ERROR, errorResponse);
  }

  // Public methods for external use
  public broadcastMessage(event: string, data: any): void {
    this.io.emit(event, data);
  }

  public getActiveConnections(): number {
    return this.activeConnections.size;
  }

  public disconnectAll(): void {
    this.io.disconnectSockets();
  }
}

export default WebSocketService;