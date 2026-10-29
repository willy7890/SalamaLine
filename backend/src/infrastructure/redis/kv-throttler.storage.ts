import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { KvStore } from './kv-store';

/**
 * Shared (Redis-backed) rate-limit store so limits hold across several API instances. Fixed window.
 * Falls back to the in-memory KvStore in development. `timeToExpire` is the full window (the KV contract has no TTL read).
 */
export class KvThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly kv: KvStore) {}

  async increment(key: string, ttl: number, limit: number, _blockDuration: number, throttlerName: string): Promise<ThrottlerStorageRecord> {
    const seconds = Math.max(1, Math.ceil(ttl / 1000));
    const hits = await this.kv.incr(`thr:${throttlerName}:${key}`, seconds);
    const blocked = hits > limit;
    return { totalHits: hits, timeToExpire: seconds, isBlocked: blocked, timeToBlockExpire: blocked ? seconds : 0 };
  }
}
