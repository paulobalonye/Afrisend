/**
 * Redis-backed OTP rate limit store.
 *
 * Production-safe: shared across all backend instances.
 * Implements IOtpRateLimitStore from otpRateLimiter.ts.
 *
 * Requires REDIS_URL in the environment.
 */

import Redis from 'ioredis';
import type { IOtpRateLimitStore, RateLimitRecord } from '../otpRateLimiter';

let client: Redis | null = null;

function getRedisClient(): Redis {
  if (!client) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error('REDIS_URL environment variable is not set');
    }
    client = new Redis(url, {
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    client.on('error', (err) => {
      console.error('[redis] connection error:', err.message);
    });
  }
  return client;
}

export async function closeRedisClient(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}

export class RedisOtpRateLimitStore implements IOtpRateLimitStore {
  private readonly redis: Redis;

  constructor(redis?: Redis) {
    this.redis = redis ?? getRedisClient();
  }

  async get(key: string): Promise<RateLimitRecord | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as RateLimitRecord;
    } catch {
      return null;
    }
  }

  async set(key: string, record: RateLimitRecord, ttlMs: number): Promise<void> {
    const ttlSeconds = Math.ceil(ttlMs / 1000);
    await this.redis.set(key, JSON.stringify(record), 'EX', ttlSeconds);
  }
}
