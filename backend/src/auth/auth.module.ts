import { Global, Inject, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ENV, Env } from '../config/config.module';
import { AuthController } from './auth.controller';
import { AuthService, JWT_AUDIENCE, JWT_ISSUER } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        secret: env.JWT_ACCESS_SECRET,
        signOptions: { expiresIn: env.JWT_ACCESS_TTL, algorithm: 'HS256', issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard, AuthService],
})
export class AuthModule {
  constructor(@Inject(ENV) _env: Env) {}
}
