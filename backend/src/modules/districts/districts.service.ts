import { Injectable } from '@nestjs/common';
import { toCode } from '../../common/utils/text';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class DistrictsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.district.findMany({ where: { isActive: true }, orderBy: { nameEn: 'asc' } });
  }

  /** Resolves free text ("Mbeya City", "mbeya_city", "Kyela") to an active district code, or null. */
  async resolve(input: string | undefined | null) {
    if (!input) return null;
    const wanted = toCode(input);
    if (!wanted) return null;
    const districts = await this.list();
    return districts.find((d) => d.code === wanted || toCode(d.nameEn) === wanted || toCode(d.nameSw) === wanted) ?? null;
  }
}
