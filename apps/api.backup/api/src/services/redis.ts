import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType | null> {
  // Redis is optional - we'll try to connect but continue without it if unavailable

  if (redisClient) {
    try {
      // Check if connection is still alive
      if (redisClient.isOpen) {
        return redisClient;
      }
    } catch {
      // Connection lost, reset
      redisClient = null;
    }
  }

  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = createClient({ url: redisUrl });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
      redisClient = null;
    });

    await redisClient.connect();
    return redisClient;
  } catch (err) {
    console.warn('Redis connection failed, continuing without cache:', err);
    redisClient = null;
    return null;
  }
}

export async function closeRedis() {
  if (redisClient) {
    try {
      if (redisClient.isOpen) {
        await redisClient.quit();
      }
    } catch (err) {
      console.error('Error closing Redis:', err);
    }
    redisClient = null;
  }
}

export const redis = {
  async get(key: string): Promise<string | null> {
    try {
      const client = await getRedisClient();
      if (!client) return null;
      return await client.get(key);
    } catch (err) {
      console.warn('Redis GET error (non-fatal):', err);
      return null;
    }
  },

  async set(key: string, value: string, options?: { EX?: number }): Promise<void> {
    try {
      const client = await getRedisClient();
      if (!client) return;
      if (options?.EX) {
        await client.setEx(key, options.EX, value);
      } else {
        await client.set(key, value);
      }
    } catch (err) {
      console.warn('Redis SET error (non-fatal):', err);
    }
  },
};

