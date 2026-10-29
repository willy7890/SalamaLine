import { UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  districtCode: string | null;
  /** True only when this session was authenticated with a valid second factor. */
  mfa?: boolean;
}
