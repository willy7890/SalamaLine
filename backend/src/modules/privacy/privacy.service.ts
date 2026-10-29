import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { PhoneHashService } from '../../common/crypto/phone-hash.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { KV_STORE, KvStore } from '../../infrastructure/redis/kv-store';
import { wipeContactData } from '../help-requests/help-requests.service';

export const consentKey = (phoneHash: string) => `consent:${phoneHash}`;

/** "Delete my data" (USSD 99, SMS FUTA). Works from the phone number alone: no account needed. */
@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashes: PhoneHashService,
    private readonly audit: AuditService,
    @Inject(KV_STORE) private readonly kv: KvStore,
  ) {}

  async deleteByPhone(phone: string) {
    const hash = this.hashes.hash(phone);
    const [requests, notifications] = await this.prisma.$transaction([
      // Wipe the number from every case it is on. Cases stay (minus contact) so responders keep their record; open ones are cancelled.
      this.prisma.helpRequest.updateMany({
        where: { contactHash: hash },
        data: { ...wipeContactData(), status: 'CANCELLED', closedAt: new Date() },
      }),
      this.prisma.notification.deleteMany({ where: { recipientHash: hash, status: 'QUEUED' } }),
    ]);
    await this.kv.del(consentKey(hash));
    await this.audit.record({ action: 'PRIVACY_DELETE', resourceType: 'Subscriber', outcome: 'SUCCESS' });
    return { requestsWiped: requests.count, notificationsRemoved: notifications.count };
  }
}
