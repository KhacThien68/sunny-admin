import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ColumnSpec, ExcelService, SheetSpec } from './excel.service';

/**
 * Helper: build an Excel buffer from a 2D array (first row = headers).
 */
async function buildBuffer(
  rows: (string | number | null)[][],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  for (const row of rows) {
    ws.addRow(row);
  }
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}

describe('ExcelService', () => {
  let service: ExcelService;

  const basicSpec: SheetSpec = {
    columns: [
      { header: 'Component', key: 'code', required: true, type: 'string' },
      { header: 'UoM', key: 'uom', required: true, type: 'string' },
      { header: 'Qty', key: 'qty', required: false, type: 'number' },
      {
        header: 'Status',
        key: 'status',
        required: false,
        type: 'enum',
        enumValues: ['ACTIVE', 'INACTIVE'],
      },
    ],
  };

  beforeEach(() => {
    service = new ExcelService();
  });

  // ─── buildTemplate ────────────────────────────────────────────────────────

  describe('buildTemplate', () => {
    it('should return a non-empty Buffer', async () => {
      const buf = await service.buildTemplate(basicSpec);
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBeGreaterThan(0);
    });

    it('should produce a workbook whose first row contains all headers', async () => {
      const buf = await service.buildTemplate(basicSpec);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as unknown as ArrayBuffer);
      const ws = wb.worksheets[0];
      const headerRow = ws.getRow(1).values as (string | undefined)[];
      // ExcelJS row.values is 1-indexed; index 0 is undefined
      const headers = headerRow.slice(1);
      expect(headers).toEqual(basicSpec.columns.map((c) => c.header));
    });
  });

  // ─── parse — happy path ───────────────────────────────────────────────────

  describe('parse', () => {
    it('should parse a valid file and return correct rows', async () => {
      const buf = await buildBuffer([
        ['Component', 'UoM', 'Qty', 'Status'],
        ['COMP-001', 'PC', 5, 'ACTIVE'],
        ['COMP-002', 'KG', 10, 'INACTIVE'],
      ]);

      const result = await service.parse<Record<string, unknown>>(
        buf,
        basicSpec,
      );

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toMatchObject({
        code: 'COMP-001',
        uom: 'PC',
        qty: 5,
        status: 'ACTIVE',
      });
      expect(result.rows[1]).toMatchObject({
        code: 'COMP-002',
        uom: 'KG',
        qty: 10,
        status: 'INACTIVE',
      });
    });

    it('should skip blank rows and not count them as errors', async () => {
      const buf = await buildBuffer([
        ['Component', 'UoM', 'Qty', 'Status'],
        ['COMP-001', 'PC', null, null],
        [null, null, null, null], // blank row
        ['COMP-003', 'M', null, null],
      ]);

      const result = await service.parse<Record<string, unknown>>(
        buf,
        basicSpec,
      );

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(2);
    });

    it('should ignore extra columns not in spec', async () => {
      const buf = await buildBuffer([
        ['Component', 'UoM', 'Qty', 'Status', 'Extra'],
        ['COMP-001', 'PC', 1, 'ACTIVE', 'ignored'],
      ]);

      const result = await service.parse<Record<string, unknown>>(
        buf,
        basicSpec,
      );
      expect(result.errors).toHaveLength(0);
      expect(result.rows[0]).not.toHaveProperty('Extra');
    });
  });

  // ─── parse — missing header ───────────────────────────────────────────────

  describe('parse — missing header throws BadRequestException', () => {
    it('should throw BadRequestException listing the first missing header', async () => {
      // Omit "UoM" from the header row
      const buf = await buildBuffer([
        ['Component', 'Qty', 'Status'],
        ['COMP-001', 5, 'ACTIVE'],
      ]);

      await expect(service.parse(buf, basicSpec)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.parse(buf, basicSpec)).rejects.toThrow('UoM');
    });

    it('should include the missing header name in the exception message', async () => {
      const buf = await buildBuffer([
        ['UoM', 'Qty', 'Status'], // "Component" missing
        ['PC', 5, 'ACTIVE'],
      ]);

      await expect(service.parse(buf, basicSpec)).rejects.toThrow(
        'Sai định dạng file mẫu: thiếu cột "Component"',
      );
    });
  });

  // ─── parse — required cell empty ─────────────────────────────────────────

  describe('parse — required cell empty', () => {
    it('should add RowError with correct row number and column header', async () => {
      const buf = await buildBuffer([
        ['Component', 'UoM', 'Qty', 'Status'],
        [null, 'PC', null, null], // "Component" missing → row 2 in Excel (row 1 = header)
      ]);

      const result = await service.parse<Record<string, unknown>>(
        buf,
        basicSpec,
      );

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        row: 2,
        column: 'Component',
        message: 'Thiếu giá trị',
      });
      expect(result.rows).toHaveLength(0); // row with error excluded
    });

    it('should report error for required UoM missing', async () => {
      const buf = await buildBuffer([
        ['Component', 'UoM', 'Qty', 'Status'],
        ['COMP-001', null, null, null],
      ]);

      const result = await service.parse<Record<string, unknown>>(
        buf,
        basicSpec,
      );

      expect(
        result.errors.some(
          (e) => e.column === 'UoM' && e.message === 'Thiếu giá trị',
        ),
      ).toBe(true);
    });
  });

  // ─── parse — type number error ────────────────────────────────────────────

  describe('parse — number type validation', () => {
    it('should add RowError for text in a number column', async () => {
      const buf = await buildBuffer([
        ['Component', 'UoM', 'Qty', 'Status'],
        ['COMP-001', 'PC', 'not-a-number', null],
      ]);

      const result = await service.parse<Record<string, unknown>>(
        buf,
        basicSpec,
      );

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        row: 2,
        column: 'Qty',
        message: 'Giá trị phải là số',
      });
    });

    it('should accept numeric string values in number columns', async () => {
      const buf = await buildBuffer([
        ['Component', 'UoM', 'Qty', 'Status'],
        ['COMP-001', 'PC', '42', null],
      ]);

      const result = await service.parse<Record<string, unknown>>(
        buf,
        basicSpec,
      );
      expect(result.errors).toHaveLength(0);
      expect((result.rows[0] as any).qty).toBe(42);
    });
  });

  // ─── parse — enum validation ──────────────────────────────────────────────

  describe('parse — enum type validation', () => {
    it('should add RowError for invalid enum value', async () => {
      const buf = await buildBuffer([
        ['Component', 'UoM', 'Qty', 'Status'],
        ['COMP-001', 'PC', null, 'UNKNOWN'],
      ]);

      const result = await service.parse<Record<string, unknown>>(
        buf,
        basicSpec,
      );

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        row: 2,
        column: 'Status',
        message: 'Giá trị không hợp lệ',
      });
    });

    it('should accept enum values case-insensitively', async () => {
      const buf = await buildBuffer([
        ['Component', 'UoM', 'Qty', 'Status'],
        ['COMP-001', 'PC', null, 'active'], // lowercase should match 'ACTIVE'
      ]);

      const result = await service.parse<Record<string, unknown>>(
        buf,
        basicSpec,
      );
      expect(result.errors).toHaveLength(0);
    });

    it('should accept enum values with surrounding whitespace', async () => {
      const buf = await buildBuffer([
        ['Component', 'UoM', 'Qty', 'Status'],
        ['COMP-001', 'PC', null, '  ACTIVE  '],
      ]);

      const result = await service.parse<Record<string, unknown>>(
        buf,
        basicSpec,
      );
      expect(result.errors).toHaveLength(0);
    });
  });

  // ─── parse — multiple errors collected ───────────────────────────────────

  describe('parse — collect all errors across rows', () => {
    it('should collect errors from multiple rows and return correct row numbers', async () => {
      const buf = await buildBuffer([
        ['Component', 'UoM', 'Qty', 'Status'],
        [null, 'PC', null, null], // row 2: Component required
        ['COMP-002', 'KG', 'bad', null], // row 3: Qty not a number
        ['COMP-003', 'M', null, null], // row 4: valid
      ]);

      const result = await service.parse<Record<string, unknown>>(
        buf,
        basicSpec,
      );

      expect(result.errors).toHaveLength(2);
      expect(result.errors.find((e) => e.row === 2)?.column).toBe('Component');
      expect(result.errors.find((e) => e.row === 3)?.column).toBe('Qty');
      expect(result.rows).toHaveLength(1);
      expect((result.rows[0] as any).code).toBe('COMP-003');
    });
  });
});
