import { createClient, RedisClientType } from 'redis';
import config from '../config/config';
import { ChatMessage, ChatSession, REDIS_KEYS } from '../types/chat';

class RedisService {
  private client!: RedisClientType;
  private readonly sessionExpiry: number = 24 * 60 * 60; // 24 hours in seconds
  private readonly maxRetries: number = 10;
  private readonly initialRetryDelay: number = 1000; // 1 second
  private readonly maxRetryDelay: number = 30000; // 30 seconds
  private retryCount: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;
  private commandBuffer: Array<() => Promise<void>> = [];

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    this.client = createClient({
      url: `redis://${config.redis.host}:${config.redis.port}`,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > this.maxRetries) {
            console.error(`Redis max retries (${this.maxRetries}) exceeded`);
            return new Error('Max retries exceeded');
          }
          const delay = Math.min(
            this.initialRetryDelay * Math.pow(2, retries),
            this.maxRetryDelay
          );
          console.log(`Redis reconnecting in ${delay}ms (attempt ${retries + 1}/${this.maxRetries})`);
          return delay;
        }
      }
    });

    this.setupEventHandlers();
    this.connect();
  }

  private setupEventHandlers() {
    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
      this.handleError(err);
    });

    this.client.on('connect', () => {
      console.log('Redis Client Connected');
      this.retryCount = 0;
      this.processCommandBuffer();
    });

    this.client.on('reconnecting', () => {
      console.log('Redis Client Reconnecting...');
    });

    this.client.on('end', () => {
      console.log('Redis Connection Ended');
      this.scheduleReconnect();
    });
  }

  private async connect() {
    if (this.isConnecting) return;
    
    try {
      this.isConnecting = true;
      await this.client.connect();
      this.isConnecting = false;
      this.startHealthCheck();
    } catch (error) {
      console.error('Redis Connection Error:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private handleError(error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    const delay = Math.min(
      this.initialRetryDelay * Math.pow(2, this.retryCount),
      this.maxRetryDelay
    );

    console.log(`Scheduling Redis reconnect in ${delay}ms (attempt ${this.retryCount + 1})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.retryCount++;
      this.connect();
    }, delay);
  }

  private startHealthCheck() {
    setInterval(async () => {
      try {
        await this.client.ping();
      } catch (error) {
        console.error('Redis health check failed:', error);
        this.handleError(error);
      }
    }, 30000); // Check every 30 seconds
  }

  private async processCommandBuffer() {
    while (this.commandBuffer.length > 0) {
      const command = this.commandBuffer.shift();
      if (command) {
        try {
          await command();
        } catch (error) {
          console.error('Error processing buffered command:', error);
        }
      }
    }
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    retries: number = 3
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retries > 0 && this.client.isOpen) {
        const delay = this.initialRetryDelay * Math.pow(2, 3 - retries);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithRetry(operation, retries - 1);
      }
      throw error;
    }
  }

  async saveSession(sessionId: string, session: ChatSession): Promise<void> {
    const key = `${REDIS_KEYS.SESSION_PREFIX}${sessionId}`;
    const operation = async () => {
      if (!this.client.isOpen) {
        return new Promise<void>((resolve) => {
          this.commandBuffer.push(async () => {
            await this.saveSession(sessionId, session);
            resolve(undefined);
          });
        });
      }
      await this.client.setEx(
        key,
        this.sessionExpiry,
        JSON.stringify(session)
      );
    };

    try {
      await this.executeWithRetry(operation);
    } catch (error) {
      console.error('Error saving session:', error);
      throw new Error('Failed to save session');
    }
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    const key = `${REDIS_KEYS.SESSION_PREFIX}${sessionId}`;
    const operation = async () => {
      if (!this.client.isOpen) {
        return new Promise((resolve) => {
          this.commandBuffer.push(async () => {
            const result = await this.getSession(sessionId);
            resolve(result);
          });
        });
      }
      const session = await this.client.get(key);
      return session ? JSON.parse(session) : null;
    };

    try {
      return await this.executeWithRetry(operation);
    } catch (error) {
      console.error('Error getting session:', error);
      throw new Error('Failed to get session');
    }
  }

  async addMessageToSession(
    sessionId: string,
    message: ChatMessage
  ): Promise<void> {
    const operation = async () => {
      if (!this.client.isOpen) {
        return new Promise((resolve) => {
          this.commandBuffer.push(async () => {
            await this.addMessageToSession(sessionId, message);
            resolve(undefined);
          });
        });
      }

      const session = await this.getSession(sessionId);
      if (!session) {
        const newSession: ChatSession = {
          id: sessionId,
          messages: [message],
          context: '',
          lastActivity: Date.now(),
        };
        await this.saveSession(sessionId, newSession);
      } else {
        session.messages.push(message);
        session.lastActivity = Date.now();
        await this.saveSession(sessionId, session);
      }
    };

    try {
      await this.executeWithRetry(operation);
    } catch (error) {
      console.error('Error adding message to session:', error);
      throw new Error('Failed to add message to session');
    }
  }

  async updateContext(sessionId: string, context: string): Promise<void> {
    const operation = async () => {
      if (!this.client.isOpen) {
        return new Promise<void>((resolve) => {
          this.commandBuffer.push(async () => {
            await this.updateContext(sessionId, context);
            resolve(undefined);
          });
        });
      }

      const session = await this.getSession(sessionId);
      if (session) {
        session.context = context;
        await this.saveSession(sessionId, session);
      }
    };

    try {
      await this.executeWithRetry(operation);
    } catch (error) {
      console.error('Error updating context:', error);
      throw new Error('Failed to update context');
    }
  }

  async getRecentMessages(
    sessionId: string,
    limit: number = 10
  ): Promise<ChatMessage[]> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) return [];
      return session.messages.slice(-limit);
    } catch (error) {
      console.error('Error getting recent messages:', error);
      throw new Error('Failed to get recent messages');
    }
  }

  async clearSession(sessionId: string): Promise<void> {
    const key = `${REDIS_KEYS.SESSION_PREFIX}${sessionId}`;
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Error clearing session:', error);
      throw new Error('Failed to clear session');
    }
  }

  async set(key: string, value: any): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error setting value:', error);
      throw new Error('Failed to set value');
    }
  }

  async get(key: string): Promise<any> {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Error getting value:', error);
      throw new Error('Failed to get value');
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Error deleting key:', error);
      throw new Error('Failed to delete key');
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Error checking key existence:', error);
      throw new Error('Failed to check key existence');
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error('Error getting keys:', error);
      throw new Error('Failed to get keys');
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
    } catch (error) {
      console.error('Error disconnecting from Redis:', error);
    }
  }
}

// Export as singleton
export const redisService = new RedisService();
export default redisService;