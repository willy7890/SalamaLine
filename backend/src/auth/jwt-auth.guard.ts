import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { JWT_AUDIENCE, JWT_ISSUER } from './auth.service';

/** Verifies the bearer token, then re-reads the user so deactivation takes effect immediately. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; mfa?: boolean }>(header.slice(7), {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) throw new UnauthorizedException();
      // An MFA claim only counts while 2FA is still enabled (an admin reset takes effect immediately).
      const authUser: AuthUser = { id: user.id, email: user.email, role: user.role, districtCode: user.districtCode, mfa: payload.mfa === true && !!user.totpEnabledAt };
      req.user = authUser;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
