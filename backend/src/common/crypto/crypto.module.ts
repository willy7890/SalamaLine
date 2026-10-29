import { Global, Module } from '@nestjs/common';
import { FieldEncryptionService } from './field-encryption.service';
import { PhoneHashService } from './phone-hash.service';
import { TotpService } from './totp.service';

@Global()
@Module({ providers: [PhoneHashService, FieldEncryptionService, TotpService], exports: [PhoneHashService, FieldEncryptionService, TotpService] })
export class CryptoModule {}
