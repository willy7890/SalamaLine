import { KvStore } from './kv-store';

/** Process-local fallback for development and tests. NOT suitable for multiple instances. */
export class MemoryKvStore implements KvStore {
  readonly kind = 'memory' as const;
  private readonly data = new Map<string, { value: string; expiresAt: number }>();

  private live(key: string) {
    const entry = this.data.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.data.delete(key);
      return undefined;
    }
    return entry;
  }
  async get(key: string) {
    return this.live(key)?.value ?? null;
  }
  async set(key: string, value: string, ttlSeconds: number) {
    this.data.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
  async del(key: string) {
    this.data.delete(key);
  }
  async incr(key: string, ttlSeconds: number) {
    const entry = this.live(key);
    const next = (entry ? Number(entry.value) : 0) + 1;
    this.data.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? Date.now() + ttlSeconds * 1000 });
    return next;
  }
  async ping() {
    return true;
  }
}
