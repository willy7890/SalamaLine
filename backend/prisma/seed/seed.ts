import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import districts from './districts.json';

const prisma = new PrismaClient();

class BootstrapError extends Error {}

async function seedDistricts() {
  // Reference geography only. VERIFY this list against the official council list before a pilot.
  for (const d of districts) {
    await prisma.district.upsert({ where: { code: d.code }, create: d, update: { nameSw: d.nameSw, nameEn: d.nameEn, region: d.region } });
  }
  console.log(`Districts ready: ${districts.length}`);
}

async function seedSuperAdmin() {
  const email = (process.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email) throw new BootstrapError('Set SUPER_ADMIN_EMAIL in .env.');
  if (!password) {
    console.log('SEED_ADMIN_PASSWORD not set: skipping super administrator bootstrap.');
    return;
  }
  if (password.length < 14) throw new BootstrapError('SEED_ADMIN_PASSWORD must be at least 14 characters.');
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash, displayName: 'SalamaLine Super Administrator', role: UserRole.ADMIN, isActive: true },
    update: { passwordHash, role: UserRole.ADMIN, isActive: true },
  });
  console.log('Super administrator ready. Keep the password private and out of source control.');
}

async function main() {
  await seedDistricts();
  await seedSuperAdmin();
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof BootstrapError ? `Seed failed: ${error.message}` : 'Seed failed. Check DATABASE_URL and database connectivity.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
