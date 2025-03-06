import { redisService } from '../services/redis.service';

export async function checkRedisConnection(): Promise<boolean> {
  try {
    // Try to connect to Redis
    await redisService.getSession('test-connection');
    console.log('✅ Redis connection successful');
    return true;
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    console.log('\nPlease ensure Redis is running:');
    console.log('1. Start Redis using Docker:');
    console.log('   docker-compose up -d');
    console.log('\n2. Or update Redis configuration in .env:');
    console.log('   REDIS_HOST=your-redis-host');
    console.log('   REDIS_PORT=your-redis-port\n');
    return false;
  }
}