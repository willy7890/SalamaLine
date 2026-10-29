import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ENV, Env } from '../../config/config.module';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, @Inject(ENV) private readonly env: Env) {}
  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    // Deny by default: a route behind RolesGuard without @Roles() is a programming error, not an open door.
    if (!roles?.length) throw new ForbiddenException('Insufficient permissions');
    const user = context.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.role)) throw new ForbiddenException('Insufficient permissions');
    // Staff who can act on girls' cases must have signed in with a second factor (when required).
    if (this.env.REQUIRE_MFA_STAFF && !user.mfa) {
      throw new ForbiddenException({ statusCode: 403, message: 'Two-factor authentication required', code: 'MFA_REQUIRED' });
    }
    return true;
  }
}
