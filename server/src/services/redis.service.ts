import { createClient, RedisClientType } from 'redis';
import config from '../config/config';
import { ChatMessage, ChatSession, REDIS_KEYS } from '../types/chat';

class RedisService {
  private client: RedisClientType;
  private readonly sessionExpiry: number = 24 * 60 * 60; // 24 hours in seconds

  constructor() {
    this.client = createClient({
      url: `redis://${config.redis.host}:${config.redis.port}`,
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis Client Connected');
    });

    this.connect();
  }

  private async connect() {
    try {
      await this.client.connect();
    } catch (error) {
      console.error('Redis Connection Error:', error);
      // Implement retry logic here if needed
    }
  }

  async saveSession(sessionId: string, session: ChatSession): Promise<void> {
    const key = `${REDIS_KEYS.SESSION_PREFIX}${sessionId}`;
    try {
      await this.client.setEx(
        key,
        this.sessionExpiry,
        JSON.stringify(session)
      );
    } catch (error) {
      console.error('Error saving session:', error);
      throw new Error('Failed to save session');
    }
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    const key = `${REDIS_KEYS.SESSION_PREFIX}${sessionId}`;
    try {
      const session = await this.client.get(key);
      return session ? JSON.parse(session) : null;
    } catch (error) {
      console.error('Error getting session:', error);
      throw new Error('Failed to get session');
    }
  }

  async addMessageToSession(
    sessionId: string,
    message: ChatMessage
  ): Promise<void> {
    try {
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
    } catch (error) {
      console.error('Error adding message to session:', error);
      throw new Error('Failed to add message to session');
    }
  }

  async updateContext(sessionId: string, context: string): Promise<void> {
    try {
      const session = await this.getSession(sessionId);
      if (session) {
        session.context = context;
        await this.saveSession(sessionId, session);
      }
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