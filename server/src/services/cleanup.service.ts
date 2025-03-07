import * as fs from 'fs';
import * as path from 'path';
import { redisService } from './redis.service';
import { REDIS_KEYS } from '../types/chat';

class CleanupService {
  private readonly audioDir: string;
  private readonly maxAgeMs: number = 1000 * 60 * 60; // 1 hour
  private readonly cleanupInterval: number = 1000 * 60 * 15; // 15 minutes
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.audioDir = path.join(__dirname, '../../audio');
    this.ensureAudioDirectory();
  }

  private ensureAudioDirectory(): void {
    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }
  }

  // Start the cleanup scheduler
  start(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cleanupTimer = setInterval(() => this.cleanup(), this.cleanupInterval);
    console.log('Audio cleanup service started');
  }

  // Stop the cleanup scheduler
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    console.log('Audio cleanup service stopped');
  }

  // Track a new audio file in Redis
  async trackAudioFile(filepath: string): Promise<void> {
    try {
      const key = `${REDIS_KEYS.AUDIO_PREFIX}${path.basename(filepath)}`;
      await redisService.set(key, {
        path: filepath,
        created: Date.now()
      });
      console.log(`Tracked audio file: ${filepath}`);
    } catch (error) {
      console.error('Failed to track audio file:', error);
    }
  }

  // Clean up a specific audio file
  async cleanupFile(filepath: string): Promise<void> {
    try {
      if (fs.existsSync(filepath)) {
        await fs.promises.unlink(filepath);
        console.log(`Cleaned up audio file: ${filepath}`);
      }

      // Remove from Redis regardless of file existence
      const key = `${REDIS_KEYS.AUDIO_PREFIX}${path.basename(filepath)}`;
      await redisService.del(key);
    } catch (error) {
      console.error(`Failed to cleanup audio file ${filepath}:`, error);
      // Don't throw - we want to continue with other files even if one fails
    }
  }

  // Main cleanup function
  private async cleanup(): Promise<void> {
    try {
      console.log('Starting audio file cleanup...');
      const now = Date.now();

      // Get all audio files from Redis
      const pattern = `${REDIS_KEYS.AUDIO_PREFIX}*`;
      const keys = await redisService.keys(pattern);
      
      for (const key of keys) {
        try {
          const fileInfo = await redisService.get(key);
          if (!fileInfo) continue;

          // Check if file is old enough to delete
          if (now - fileInfo.created > this.maxAgeMs) {
            await this.cleanupFile(fileInfo.path);
          }
        } catch (error) {
          console.error(`Error processing Redis key ${key}:`, error);
        }
      }

      // Cleanup any orphaned files in the audio directory
      const files = await fs.promises.readdir(this.audioDir);
      for (const file of files) {
        const filepath = path.join(this.audioDir, file);
        const key = `${REDIS_KEYS.AUDIO_PREFIX}${file}`;

        try {
          const stats = await fs.promises.stat(filepath);
          const age = now - stats.mtimeMs;

          // If file is old and not in Redis, delete it
          if (age > this.maxAgeMs && !(await redisService.exists(key))) {
            await fs.promises.unlink(filepath);
            console.log(`Cleaned up orphaned audio file: ${filepath}`);
          }
        } catch (error) {
          console.error(`Error checking file ${filepath}:`, error);
        }
      }

      console.log('Audio file cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  // Force immediate cleanup
  async forceCleanup(): Promise<void> {
    await this.cleanup();
  }
}

// Export as singleton
export const cleanupService = new CleanupService();
export default cleanupService;