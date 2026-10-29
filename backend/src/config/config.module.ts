import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { Env, loadEnv } from './env.schema';

export const ENV = Symbol('ENV');
export type { Env };

@Global()
@Module({
  imports: [NestConfigModule.forRoot({ envFilePath: '.env' })],
  providers: [{ provide: ENV, useFactory: () => Object.freeze(loadEnv()) }],
  exports: [ENV],
})
export class AppConfigModule {}
