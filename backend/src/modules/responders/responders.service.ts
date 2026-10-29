import { Injectable } from '@nestjs/common';
import { PhoneHashService } from '../../common/crypto/phone-hash.service';
import { AuthUser } from '../../common/types/auth-user';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { normaliseCaseCode } from '../help-requests/case-code';
import { HelpRequestsService } from '../help-requests/help-requests.service';

export const RESPONDER_PROTOCOL =
  'Protocol: confirm it is safe to talk. Do NOT contact the family without a safety plan. Reply CLOSE <code> when done.';

/** Handles responders replying by SMS ("ACK SL-XXXXXX", "CLOSE SL-XXXXXX") from their registered phone. */
@Injectable()
export class RespondersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashes: PhoneHashService,
    private readonly requests: HelpRequestsService,
  ) {}

  async identify(phone: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { phoneHash: this.hashes.hash(phone) } });
    if (!user || !user.isActive || !['RESPONDER', 'DISTRICT_FOCAL'].includes(user.role)) return null;
    return { id: user.id, email: user.email, role: user.role, districtCode: user.districtCode };
  }

  async ack(user: AuthUser, rawCode: string): Promise<string> {
    const caseCode = normaliseCaseCode(rawCode);
    if (!caseCode) return 'SalamaLine: that case code is not valid. Format: ACK SL-XXXXXX';
    try {
      const accepted = await this.requests.acceptByCaseCode(user, caseCode);
      const contact = accepted.hasContact ? 'The person agreed to be contacted: open the case in the app to see the number.' : 'No contact number (anonymous).';
      return `SalamaLine: you accepted ${accepted.caseCode}. ${contact} ${RESPONDER_PROTOCOL}`;
    } catch {
      return `SalamaLine: could not accept ${caseCode} (already taken, unknown or outside your district).`;
    }
  }

  async close(user: AuthUser, rawCode: string): Promise<string> {
    const caseCode = normaliseCaseCode(rawCode);
    if (!caseCode) return 'SalamaLine: that case code is not valid. Format: CLOSE SL-XXXXXX';
    try {
      await this.requests.closeByCaseCode(user, caseCode);
      return `SalamaLine: ${caseCode} closed. The contact details were wiped.`;
    } catch {
      return `SalamaLine: could not close ${caseCode} (only the assigned responder can close it).`;
    }
  }
}
