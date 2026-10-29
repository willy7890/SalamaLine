export const KV_STORE = Symbol('KV_STORE');

/** Minimal key-value contract used for short-lived state (consent prompts, rate limits, lockouts). */
export interface KvStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Atomically increments a counter; the TTL is applied when the counter is created. */
  incr(key: string, ttlSeconds: number): Promise<number>;
  ping(): Promise<boolean>;
  readonly kind: 'redis' | 'memory';
}
