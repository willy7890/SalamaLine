import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ENV, Env } from '../../config/config.module';
import { KV_STORE, KvStore } from './kv-store';
import { MemoryKvStore } from './memory-kv.store';
import { RedisKvStore } from './redis-kv.store';

@Global()
@Module({
  providers: [
    {
      provide: KV_STORE,
      inject: [ENV],
      useFactory: (env: Env): KvStore => (env.REDIS_URL ? new RedisKvStore(env.REDIS_URL) : new MemoryKvStore()),
    },
  ],
  exports: [KV_STORE],
})
export class KvModule implements OnApplicationShutdown {
  constructor(@Inject(KV_STORE) private readonly kv: KvStore) {}
  async onApplicationShutdown() {
    if (this.kv instanceof RedisKvStore) await this.kv.close();
  }
}
