import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ExcelService } from '../common/excel/excel.service';
import { OnhandInventory } from './onhand.entity';
import { OnhandService } from './onhand.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRecord(
  id: number,
  componentCode: string,
  quantity = 0,
): OnhandInventory {
  const record = new OnhandInventory();
  record.id = id;
  record.componentCode = componentCode;
  record.quantity = quantity;
  record.updatedAt = new Date();
  return record;
}

async function buildOnhandBuffer(
  rows: (string | number | null)[][],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow(['Component', 'Component description', 'On-Hand Inventory']);
  for (const row of rows) {
    ws.addRow(row);
  }
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}

// ── Mock setup ────────────────────────────────────────────────────────────────

const makeRepo = (records: OnhandInventory[] = []) => ({
  find: jest.fn().mockResolvedValue(records),
  findOne: jest.fn(),
  create: jest.fn((dto: any) => ({ ...dto })),
  save: jest.fn(async (e: any) => ({
    id: Math.random(),
    updatedAt: new Date(),
    ...e,
  })),
  delete: jest.fn(),
});

const makeComponentsService = (registeredCodes: string[] = []) => ({
  getCodeMap: jest.fn().mockImplementation(async (codes: string[]) => {
    const map = new Map<string, any>();
    for (const code of codes) {
      if (registeredCodes.includes(code)) {
        map.set(code, { code, description: `${code}-desc` });
      }
    }
    return map;
  }),
});

const makeDataSource = () => ({
  transaction: jest.fn(async (cb: (em: any) => Promise<any>) => {
    const em: any = {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((dto: any) => ({ ...dto })),
        save: jest.fn(async (e: any) => ({
          id: Math.random(),
          updatedAt: new Date(),
          ...e,
        })),
      }),
    };
    return cb(em);
  }),
});

function makeService(
  records: OnhandInventory[] = [],
  registeredCodes: string[] = [],
): OnhandService {
  const repo = makeRepo(records);
  const componentsService = makeComponentsService(registeredCodes);
  const excelService = new ExcelService();
  const dataSource = makeDataSource();
  return new OnhandService(
    repo as any,
    componentsService as any,
    excelService,
    dataSource as any,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OnhandService', () => {
  // ── upsert ────────────────────────────────────────────────────────────────────

  describe('upsert', () => {
    it('creates a new record when code does not exist', async () => {
      const service = makeService();
      const repo = (service as any).onhandRepo;
      repo.findOne.mockResolvedValue(null);

      const result = await service.upsert('COMP-A', 10);

      expect(repo.create).toHaveBeenCalledWith({
        componentCode: 'COMP-A',
        quantity: 10,
      });
      expect(repo.save).toHaveBeenCalled();
      expect(result.componentCode).toBe('COMP-A');
      expect(result.quantity).toBe(10);
    });

    it('updates quantity when record already exists', async () => {
      const existing = makeRecord(1, 'COMP-A', 5);
      const service = makeService([existing]);
      const repo = (service as any).onhandRepo;
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockResolvedValue({ ...existing, quantity: 20 });

      const result = await service.upsert('COMP-A', 20);

      expect(repo.save).toHaveBeenCalled();
      expect(result.quantity).toBe(20);
    });

    it('throws BadRequestException for empty componentCode', async () => {
      const service = makeService();
      await expect(service.upsert('  ', 5)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.upsert('', 5)).rejects.toThrow(BadRequestException);
    });

    it('trims componentCode before saving', async () => {
      const service = makeService();
      const repo = (service as any).onhandRepo;
      repo.findOne.mockResolvedValue(null);

      await service.upsert('  COMP-B  ', 3);

      expect(repo.create).toHaveBeenCalledWith({
        componentCode: 'COMP-B',
        quantity: 3,
      });
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('throws NotFoundException when record not found', async () => {
      const service = makeService();
      const repo = (service as any).onhandRepo;
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('deletes record when found', async () => {
      const record = makeRecord(1, 'COMP-A', 5);
      const service = makeService([record]);
      const repo = (service as any).onhandRepo;
      repo.findOne.mockResolvedValue(record);

      await service.remove(1);
      expect(repo.delete).toHaveBeenCalledWith(1);
    });
  });

  // ── getQuantityMap ────────────────────────────────────────────────────────────

  describe('getQuantityMap', () => {
    it('returns 0 for codes not in the database', async () => {
      const service = makeService([]);
      const repo = (service as any).onhandRepo;
      repo.find.mockResolvedValue([]);

      const map = await service.getQuantityMap(['COMP-X', 'COMP-Y']);

      expect(map.get('COMP-X')).toBe(0);
      expect(map.get('COMP-Y')).toBe(0);
    });

    it('returns actual quantities for known codes', async () => {
      const records = [
        makeRecord(1, 'COMP-A', 15),
        makeRecord(2, 'COMP-B', 30),
      ];
      const service = makeService(records);
      const repo = (service as any).onhandRepo;
      repo.find.mockResolvedValue(records);

      const map = await service.getQuantityMap(['COMP-A', 'COMP-B', 'COMP-C']);

      expect(map.get('COMP-A')).toBe(15);
      expect(map.get('COMP-B')).toBe(30);
      expect(map.get('COMP-C')).toBe(0);
    });

    it('returns empty map for empty codes array', async () => {
      const service = makeService();
      const map = await service.getQuantityMap([]);
      expect(map.size).toBe(0);
    });
  });

  // ── importFromExcel ───────────────────────────────────────────────────────────

  describe('importFromExcel', () => {
    it('returns RowError when On-Hand Inventory is negative', async () => {
      const service = makeService([], []);
      const buf = await buildOnhandBuffer([['COMP-A', null, -5]]);

      const result = await service.importFromExcel(buf, 'preview');

      expect(result.errors.length).toBeGreaterThan(0);
      const qtyError = result.errors.find(
        (e) => e.message === 'Tồn kho không được âm',
      );
      expect(qtyError).toBeDefined();
      // First data row is Excel row 2 (row 1 = headers)
      expect(qtyError!.row).toBe(2);
    });

    it('issues warning (not error) for unregistered code', async () => {
      const service = makeService([], []); // no registered codes
      const buf = await buildOnhandBuffer([['COMP-UNKNOWN', null, 10]]);

      const result = await service.importFromExcel(buf, 'preview');

      expect(result.errors).toHaveLength(0);
      expect(result.warnings.some((w) => w.includes('COMP-UNKNOWN'))).toBe(
        true,
      );
    });

    it('duplicate codes in file — last row wins', async () => {
      const service = makeService([], []);
      const buf = await buildOnhandBuffer([
        ['COMP-A', null, 5],
        ['COMP-A', null, 20], // duplicate — last wins
      ]);

      const result = await service.importFromExcel(buf, 'preview');

      expect(result.valid).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts zero quantity (boundary: qty >= 0 is valid)', async () => {
      const service = makeService([], ['COMP-A']);
      const buf = await buildOnhandBuffer([['COMP-A', null, 0]]);

      const result = await service.importFromExcel(buf, 'preview');

      expect(result.errors).toHaveLength(0);
      expect(result.valid).toBe(1);
    });

    it('commits valid rows in transaction on commit mode', async () => {
      const service = makeService([], ['COMP-A']);
      const dataSource = (service as any).dataSource;
      const buf = await buildOnhandBuffer([['COMP-A', null, 10]]);

      const result = await service.importFromExcel(buf, 'commit');

      expect(result.committed).toBe(true);
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result.valid).toBe(1);
    });
  });
});
