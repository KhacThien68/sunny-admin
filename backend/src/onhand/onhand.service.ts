import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  ExcelService,
  RowError,
  SheetSpec,
} from '../common/excel/excel.service';
import { ComponentsService } from '../components/components.service';
import { OnhandInventory } from './onhand.entity';

export interface OnhandWithFlags extends OnhandInventory {
  registered: boolean;
  description: string | null;
}

export interface OnhandImportResult {
  valid: number;
  errors: RowError[];
  warnings: string[];
  committed: boolean;
}

const ONHAND_SPEC: SheetSpec = {
  columns: [
    {
      header: 'Component',
      key: 'componentCode',
      required: true,
      type: 'string',
    },
    {
      header: 'Component description',
      key: 'description',
      required: false,
      type: 'string',
    },
    {
      header: 'On-Hand Inventory',
      key: 'quantity',
      required: true,
      type: 'number',
    },
  ],
};

interface ParsedOnhandRow {
  componentCode: string;
  quantity: number;
  __row: number;
}

@Injectable()
export class OnhandService {
  constructor(
    @InjectRepository(OnhandInventory)
    private readonly onhandRepo: Repository<OnhandInventory>,
    private readonly componentsService: ComponentsService,
    private readonly excelService: ExcelService,
    private readonly dataSource: DataSource,
  ) {}

  // ────────────────────────────────────────────────────────────────────────────
  //  Read
  // ────────────────────────────────────────────────────────────────────────────

  async findAll(): Promise<OnhandWithFlags[]> {
    const records = await this.onhandRepo.find({
      order: { componentCode: 'ASC' },
    });

    if (records.length === 0) return [];

    const allCodes = records.map((r) => r.componentCode);
    const codeMap = await this.componentsService.getCodeMap(allCodes);

    return records.map((record) => ({
      ...record,
      registered: codeMap.has(record.componentCode),
      description: codeMap.get(record.componentCode)?.description ?? null,
    }));
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  Upsert
  // ────────────────────────────────────────────────────────────────────────────

  async upsert(
    componentCode: string,
    quantity: number,
  ): Promise<OnhandInventory> {
    const trimmed = componentCode.trim();
    if (!trimmed) {
      throw new BadRequestException('Mã thành phần không được để trống');
    }

    const existing = await this.onhandRepo.findOne({
      where: { componentCode: trimmed },
    });
    if (existing) {
      existing.quantity = quantity;
      return this.onhandRepo.save(existing);
    }

    const record = this.onhandRepo.create({ componentCode: trimmed, quantity });
    return this.onhandRepo.save(record);
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  Remove
  // ────────────────────────────────────────────────────────────────────────────

  async remove(id: number): Promise<void> {
    const existing = await this.onhandRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy bản ghi tồn kho');
    }
    await this.onhandRepo.delete(id);
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  MRP helper
  // ────────────────────────────────────────────────────────────────────────────

  async getQuantityMap(codes: string[]): Promise<Map<string, number>> {
    if (codes.length === 0) return new Map();

    const records = await this.onhandRepo.find({
      where: codes.map((code) => ({ componentCode: code })),
    });

    const map = new Map<string, number>();
    // Initialize all requested codes to 0
    for (const code of codes) {
      map.set(code, 0);
    }
    // Override with actual values
    for (const record of records) {
      map.set(record.componentCode, record.quantity);
    }
    return map;
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  Import
  // ────────────────────────────────────────────────────────────────────────────

  async buildImportTemplate(): Promise<Buffer> {
    return this.excelService.buildTemplate(ONHAND_SPEC);
  }

  async importFromExcel(
    buffer: Buffer,
    mode: 'preview' | 'commit',
  ): Promise<OnhandImportResult> {
    const parsed = await this.excelService.parse<Record<string, unknown>>(
      buffer,
      ONHAND_SPEC,
    );

    // Start with errors from the generic parser
    const allErrors: RowError[] = [...parsed.errors];
    const warnings: string[] = [];

    // Domain-level validation on successfully-parsed rows
    const domainValidRows: ParsedOnhandRow[] = [];

    for (const row of parsed.rows) {
      const componentCode = row['componentCode'] as string;
      const qty = row['quantity'] as number;
      const excelRow = row['__row'] as number;

      if (qty < 0) {
        allErrors.push({
          row: excelRow,
          column: 'On-Hand Inventory',
          message: 'Tồn kho không được âm',
        });
        continue;
      }

      domainValidRows.push({ componentCode, quantity: qty, __row: excelRow });
    }

    // In-file deduplication: last code wins
    const deduped = new Map<string, ParsedOnhandRow>();
    for (const row of domainValidRows) {
      deduped.set(row.componentCode, row);
    }
    const dedupedRows = Array.from(deduped.values());

    // Collect unregistered codes as warnings (non-blocking)
    const allCodesInFile = new Set(dedupedRows.map((r) => r.componentCode));
    if (allCodesInFile.size > 0) {
      const codeMap = await this.componentsService.getCodeMap([
        ...allCodesInFile,
      ]);
      for (const code of allCodesInFile) {
        if (!codeMap.has(code)) {
          warnings.push(`Mã ${code} chưa được khai báo tại Quản lý mã`);
        }
      }
    }

    if (mode === 'commit' && dedupedRows.length > 0) {
      await this.dataSource.transaction(async (em: EntityManager) => {
        const repo = em.getRepository(OnhandInventory);
        for (const row of dedupedRows) {
          const existing = await repo.findOne({
            where: { componentCode: row.componentCode },
          });
          if (existing) {
            existing.quantity = row.quantity;
            await repo.save(existing);
          } else {
            const record = repo.create({
              componentCode: row.componentCode,
              quantity: row.quantity,
            });
            await repo.save(record);
          }
        }
      });
    }

    return {
      valid: dedupedRows.length,
      errors: allErrors,
      warnings,
      committed: mode === 'commit',
    };
  }
}
