import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  ExcelService,
  RowError,
  SheetSpec,
} from '../common/excel/excel.service';
import { User } from './user.entity';

export interface PersonnelImportResult {
  valid: number;
  errors: RowError[];
  committed: boolean;
}

const PERSONNEL_SPEC: SheetSpec = {
  columns: [
    { header: 'Personal', key: 'name', required: true, type: 'string' },
    { header: 'Position', key: 'position', required: false, type: 'string' },
    { header: 'Team', key: 'team', required: false, type: 'string' },
    { header: 'Mail', key: 'email', required: true, type: 'string' },
    { header: 'Phone', key: 'phone', required: false, type: 'string' },
  ],
};

interface ParsedPersonnelRow {
  name: string;
  email: string;
  position?: string;
  team?: string;
  phone?: string;
  __row: number;
}

@Injectable()
export class PersonnelImportService {
  constructor(
    private readonly excelService: ExcelService,
    private readonly dataSource: DataSource,
  ) {}

  async buildImportTemplate(): Promise<Buffer> {
    return this.excelService.buildTemplate(PERSONNEL_SPEC);
  }

  async importFromExcel(
    buffer: Buffer,
    mode: 'preview' | 'commit',
  ): Promise<PersonnelImportResult> {
    const parsed = await this.excelService.parse<Record<string, unknown>>(
      buffer,
      PERSONNEL_SPEC,
    );

    const allErrors: RowError[] = [...parsed.errors];

    // Domain-level validation: email format
    const domainValidRows: ParsedPersonnelRow[] = [];

    for (const row of parsed.rows) {
      const email = row['email'] as string;
      const rowNum = row['__row'] as number;

      if (!email.includes('@')) {
        allErrors.push({
          row: rowNum,
          column: 'Mail',
          message: 'Email không hợp lệ',
        });
        continue;
      }

      domainValidRows.push({
        name: row['name'] as string,
        email,
        position: row['position'] as string | undefined,
        team: row['team'] as string | undefined,
        phone: row['phone'] as string | undefined,
        __row: rowNum,
      });
    }

    // In-file deduplication: last email wins
    const deduped = new Map<string, ParsedPersonnelRow>();
    for (const row of domainValidRows) {
      deduped.set(row.email.toLowerCase(), row);
    }
    const dedupedRows = Array.from(deduped.values());

    if (mode === 'commit' && dedupedRows.length > 0) {
      await this.dataSource.transaction(async (em: EntityManager) => {
        const repo = em.getRepository(User);
        for (const row of dedupedRows) {
          const existing = await repo.findOne({
            where: { email: row.email },
          });
          if (existing) {
            // Upsert: update all fields except passwordHash
            existing.name = row.name;
            if (row.position !== undefined) existing.position = row.position;
            if (row.team !== undefined) existing.team = row.team;
            if (row.phone !== undefined) existing.phone = row.phone;
            await repo.save(existing);
          } else {
            const user = repo.create({
              name: row.name,
              email: row.email,
              position: row.position ?? null,
              team: row.team ?? null,
              phone: row.phone ?? null,
              passwordHash: null,
            });
            await repo.save(user);
          }
        }
      });
    }

    return {
      valid: dedupedRows.length,
      errors: allErrors,
      committed: mode === 'commit',
    };
  }
}
