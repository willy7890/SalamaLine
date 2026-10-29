import Redis from 'ioredis';
import { KvStore } from './kv-store';

export class RedisKvStore implements KvStore {
  readonly kind = 'redis' as const;
  readonly client: Redis;

  constructor(url: string) {
    this.client = new Redis(url, { maxRetriesPerRequest: 2, enableReadyCheck: true });
    // Never log connection strings (they can contain passwords).
    this.client.on('error', () => undefined);
  }
  get(key: string) {
    return this.client.get(key);
  }
  async set(key: string, value: string, ttlSeconds: number) {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }
  async del(key: string) {
    await this.client.del(key);
  }
  async incr(key: string, ttlSeconds: number) {
    const n = await this.client.incr(key);
    if (n === 1) await this.client.expire(key, ttlSeconds);
    return n;
  }
  async ping() {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
  async close() {
    await this.client.quit().catch(() => undefined);
  }
}
