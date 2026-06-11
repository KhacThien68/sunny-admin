import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { ExcelService, RowError, SheetSpec } from '../common/excel/excel.service';
import { ComponentEntity, Mob } from './component.entity';
import { CreateComponentDto } from './dto/component.dto';
import { UpdateComponentDto } from './dto/component.dto';

export interface FindAllQuery {
  search?: string;
  classification?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ImportResult {
  valid: number;
  errors: RowError[];
  committed: boolean;
}

/** MoB values accepted in the Excel file (case-insensitive). */
const MOB_ACCEPTED_VALUES = ['Không', 'Có thể', 'Bắt buộc', 'KHONG', 'CO_THE', 'BAT_BUOC'];

const COMPONENTS_SPEC: SheetSpec = {
  columns: [
    { header: 'Component', key: 'code', required: true, type: 'string' },
    { header: 'Component classification', key: 'classification', required: false, type: 'string' },
    { header: 'Component description', key: 'description', required: false, type: 'string' },
    { header: 'UoM', key: 'uom', required: true, type: 'string' },
    {
      header: 'MoB (Make or Buy)',
      key: 'mob',
      required: true,
      type: 'enum',
      enumValues: MOB_ACCEPTED_VALUES,
    },
    { header: 'MoQ', key: 'moq', required: false, type: 'number' },
    { header: 'Inventory Levels', key: 'inventoryLevel', required: false, type: 'number' },
  ],
};

/** Map raw cell value (already validated against MOB_ACCEPTED_VALUES) to Mob enum. */
function mapMob(raw: string): Mob {
  const trimmed = raw.trim();
  if (trimmed === 'Không' || trimmed.toUpperCase() === 'KHONG') return Mob.KHONG;
  if (trimmed === 'Có thể' || trimmed.toUpperCase() === 'CO_THE') return Mob.CO_THE;
  if (trimmed === 'Bắt buộc' || trimmed.toUpperCase() === 'BAT_BUOC') return Mob.BAT_BUOC;
  return Mob.KHONG;
}

@Injectable()
export class ComponentsService {
  constructor(
    @InjectRepository(ComponentEntity)
    private readonly componentRepo: Repository<ComponentEntity>,
    private readonly dataSource: DataSource,
    private readonly excelService: ExcelService,
  ) {}

  async findAll(
    query: FindAllQuery = {},
  ): Promise<PaginatedResult<ComponentEntity>> {
    const { search, classification, page = 1, pageSize = 20 } = query;

    const qb = this.componentRepo
      .createQueryBuilder('c')
      .orderBy('c.code', 'ASC');

    if (search) {
      qb.andWhere('(c.code LIKE :search OR c.description LIKE :search)', {
        search: `%${search}%`,
      });
    }

    if (classification) {
      qb.andWhere('c.classification = :classification', { classification });
    }

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total, page, pageSize };
  }

  findByCode(code: string): Promise<ComponentEntity | null> {
    return this.componentRepo.findOne({ where: { code } });
  }

  findById(id: number): Promise<ComponentEntity | null> {
    return this.componentRepo.findOne({ where: { id } });
  }

  async create(dto: CreateComponentDto): Promise<ComponentEntity> {
    const existing = await this.findByCode(dto.code);
    if (existing) {
      throw new ConflictException('Mã thành phần đã tồn tại');
    }
    const entity = this.componentRepo.create(dto);
    return this.componentRepo.save(entity);
  }

  async update(id: number, dto: UpdateComponentDto): Promise<ComponentEntity> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException('Không tìm thấy mã thành phần');
    }
    Object.assign(existing, dto);
    return this.componentRepo.save(existing);
  }

  async remove(id: number): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException('Không tìm thấy mã thành phần');
    }

    // Check references in bom_lines — table may not exist yet (Task 10)
    try {
      const rows: unknown[] = await this.dataSource.query(
        `SELECT 1 FROM bom_lines WHERE parentCode = ? OR childCode = ? LIMIT 1`,
        [existing.code, existing.code],
      );
      if (rows.length > 0) {
        throw new ConflictException(
          'Mã đang được sử dụng trong BoM, không thể xóa',
        );
      }
    } catch (err) {
      // Re-throw ConflictException
      if (err instanceof ConflictException) throw err;
      // Table doesn't exist yet — ignore the error and proceed with delete
    }

    await this.componentRepo.delete(id);
  }

  async getClassifications(): Promise<string[]> {
    const rows = await this.componentRepo
      .createQueryBuilder('c')
      .select('DISTINCT c.classification', 'classification')
      .where('c.classification IS NOT NULL')
      .orderBy('c.classification', 'ASC')
      .getRawMany<{ classification: string }>();

    return rows.map((r) => r.classification);
  }

  async getCodeMap(codes: string[]): Promise<Map<string, ComponentEntity>> {
    if (codes.length === 0) return new Map();
    const items = await this.componentRepo.find({
      where: { code: In(codes) },
    });
    return new Map(items.map((item) => [item.code, item]));
  }

  /** Build and return the Excel template buffer for the components import sheet. */
  async buildImportTemplate(): Promise<Buffer> {
    const svc = this.excelService!;
    return svc.buildTemplate(COMPONENTS_SPEC);
  }

  /**
   * Parse a components Excel file, map MoB labels, deduplicate (last wins),
   * and optionally commit to DB.
   */
  async importFromExcel(
    buffer: Buffer,
    mode: 'preview' | 'commit',
  ): Promise<ImportResult> {
    const svc = this.excelService!;

    // Parse with generic service using enum values that include Vietnamese labels
    const parsed = await svc.parse<Record<string, unknown>>(buffer, COMPONENTS_SPEC);

    // Post-process: map mob values and convert remaining enum errors to domain-specific message
    const domainErrors: RowError[] = [];
    const validRawRows: Record<string, unknown>[] = [];

    // Separate mob enum errors from generic errors for rows that otherwise had no other error
    // We need to re-examine: parse already validated mob against MOB_ACCEPTED_VALUES,
    // so if there's a mob error it came from Giá trị không hợp lệ — replace with domain message.
    const processedErrors = parsed.errors.map((e) => {
      if (e.column === 'MoB (Make or Buy)' && e.message === 'Giá trị không hợp lệ') {
        return { ...e, message: 'MoB phải là Không/Có thể/Bắt buộc' };
      }
      return e;
    });

    // Build set of row numbers that have errors
    const errorRowNums = new Set(processedErrors.map((e) => e.row));

    // Map mob for valid rows
    for (const row of parsed.rows) {
      const mobRaw = row['mob'] as string | undefined;
      if (mobRaw) {
        row['mob'] = mapMob(mobRaw);
      }
      validRawRows.push(row);
    }

    // Deduplicate: last code wins
    const deduped = new Map<string, Record<string, unknown>>();
    for (const row of validRawRows) {
      const code = row['code'] as string;
      deduped.set(code, row);
    }

    const finalRows = Array.from(deduped.values());

    if (mode === 'commit') {
      await this.dataSource.transaction(async (em: EntityManager) => {
        const repo = em.getRepository(ComponentEntity);
        for (const row of finalRows) {
          const code = row['code'] as string;
          const existing = await repo.findOne({ where: { code } });
          if (existing) {
            Object.assign(existing, {
              classification: (row['classification'] as string) ?? existing.classification,
              description: (row['description'] as string) ?? existing.description,
              uom: row['uom'] as string,
              mob: row['mob'] as Mob,
              moq: (row['moq'] as number) ?? existing.moq,
              inventoryLevel: (row['inventoryLevel'] as number) ?? existing.inventoryLevel,
            });
            await repo.save(existing);
          } else {
            const entity = repo.create({
              code,
              classification: row['classification'] as string | undefined,
              description: row['description'] as string | undefined,
              uom: row['uom'] as string,
              mob: row['mob'] as Mob,
              moq: (row['moq'] as number) ?? 0,
              inventoryLevel: (row['inventoryLevel'] as number) ?? 0,
            });
            await repo.save(entity);
          }
        }
      });
    }

    return {
      valid: finalRows.length,
      errors: processedErrors,
      committed: mode === 'commit',
    };
  }
}
