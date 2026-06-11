import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ExcelService } from '../common/excel/excel.service';
import { Mob } from './component.entity';
import { ComponentsService } from './components.service';

/**
 * Helper: build an Excel buffer matching the components template layout.
 * Columns: Component | Component classification | Component description | UoM | MoB (Make or Buy) | MoQ | Inventory Levels
 */
async function buildComponentsBuffer(
  rows: (string | number | null)[][],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow([
    'Component',
    'Component classification',
    'Component description',
    'UoM',
    'MoB (Make or Buy)',
    'MoQ',
    'Inventory Levels',
  ]);
  for (const row of rows) {
    ws.addRow(row);
  }
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}

describe('ComponentsService — importFromExcel', () => {
  let service: ComponentsService;
  let excelService: ExcelService;

  const mockRepo: any = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((dto) => ({ ...dto })),
    save: jest.fn(async (e) => ({ id: Math.random(), ...e })),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
    manager: {
      save: jest.fn(async (entity) => ({ id: Math.random(), ...entity })),
    },
  };

  // Minimal transaction mock — runs the callback immediately
  const mockDataSource: any = {
    query: jest.fn(),
    transaction: jest.fn(async (cb: (em: any) => Promise<any>) => {
      const em: any = {
        getRepository: jest.fn().mockReturnValue({
          findOne: mockRepo.findOne,
          create: mockRepo.create,
          save: mockRepo.save,
        }),
      };
      return cb(em);
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.create.mockImplementation((dto: any) => ({ ...dto }));
    mockRepo.save.mockImplementation(async (e: any) => ({ id: 1, ...e }));
    mockDataSource.transaction.mockImplementation(
      async (cb: (em: any) => Promise<any>) => {
        const em: any = {
          getRepository: jest.fn().mockReturnValue({
            findOne: mockRepo.findOne,
            create: mockRepo.create,
            save: mockRepo.save,
          }),
        };
        return cb(em);
      },
    );

    excelService = new ExcelService();

    // Instantiate service with mocked dependencies (ExcelService is required 3rd param)
    service = new ComponentsService(mockRepo, mockDataSource, excelService);
  });

  // ─── preview mode ─────────────────────────────────────────────────────────

  describe('mode=preview', () => {
    it('should parse valid rows and return valid count + no errors', async () => {
      const buf = await buildComponentsBuffer([
        ['COMP-001', 'TypeA', 'Widget A', 'PC', 'Không', 10, 5],
        ['COMP-002', null, 'Widget B', 'KG', 'Có thể', null, null],
      ]);

      const result = await service.importFromExcel(buf, 'preview');

      expect(result.errors).toHaveLength(0);
      expect(result.valid).toBe(2);
      expect(result.committed).toBe(false);
    });

    it('should return errors for rows with missing required fields', async () => {
      const buf = await buildComponentsBuffer([
        [null, null, null, 'PC', 'Không', null, null], // missing Component (code)
        ['COMP-002', null, null, null, 'Không', null, null], // missing UoM
      ]);

      const result = await service.importFromExcel(buf, 'preview');

      expect(result.valid).toBe(0);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── MoB label mapping ─────────────────────────────────────────────────────

  describe('MoB label mapping', () => {
    it('should map Vietnamese labels to enum values correctly', async () => {
      const buf = await buildComponentsBuffer([
        ['COMP-001', null, null, 'PC', 'Không', null, null],
        ['COMP-002', null, null, 'PC', 'Có thể', null, null],
        ['COMP-003', null, null, 'PC', 'Bắt buộc', null, null],
      ]);

      const result = await service.importFromExcel(buf, 'preview');

      expect(result.errors).toHaveLength(0);
      expect(result.valid).toBe(3);
    });

    it('should also accept raw enum values (KHONG / CO_THE / BAT_BUOC)', async () => {
      const buf = await buildComponentsBuffer([
        ['COMP-001', null, null, 'PC', 'KHONG', null, null],
        ['COMP-002', null, null, 'PC', 'CO_THE', null, null],
        ['COMP-003', null, null, 'PC', 'BAT_BUOC', null, null],
      ]);

      const result = await service.importFromExcel(buf, 'preview');

      expect(result.errors).toHaveLength(0);
      expect(result.valid).toBe(3);
    });

    it('should add RowError with specific message for invalid MoB values', async () => {
      const buf = await buildComponentsBuffer([
        ['COMP-001', null, null, 'PC', 'INVALID_VALUE', null, null],
      ]);

      const result = await service.importFromExcel(buf, 'preview');

      expect(result.valid).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe(
        'MoB phải là Không/Có thể/Bắt buộc',
      );
      expect(result.errors[0].column).toBe('MoB (Make or Buy)');
    });
  });

  // ─── duplicate code handling ───────────────────────────────────────────────

  describe('duplicate codes within the file', () => {
    it('last row wins when the same code appears multiple times', async () => {
      const buf = await buildComponentsBuffer([
        ['COMP-001', 'TypeA', 'First', 'PC', 'Không', 10, 5],
        ['COMP-001', 'TypeB', 'Last', 'KG', 'Có thể', 20, 10], // duplicate — should win
      ]);

      const result = await service.importFromExcel(buf, 'commit');

      // Only 1 upsert should be triggered (last row)
      expect(result.valid).toBe(1);
      expect(result.committed).toBe(true);
      // The saved entity should have the last row's data
      const savedCall = mockRepo.save.mock.calls[0][0];
      expect(savedCall.uom).toBe('KG');
      expect(savedCall.mob).toBe(Mob.CO_THE);
    });
  });

  // ─── commit mode ──────────────────────────────────────────────────────────

  describe('mode=commit', () => {
    it('should call save for each valid row and set committed=true', async () => {
      const buf = await buildComponentsBuffer([
        ['COMP-001', null, null, 'PC', 'Không', null, null],
        ['COMP-002', null, null, 'KG', 'Bắt buộc', 5, 2],
      ]);

      const result = await service.importFromExcel(buf, 'commit');

      expect(result.committed).toBe(true);
      expect(result.valid).toBe(2);
      // save should have been called for each row (either create+save or update+save)
      expect(mockRepo.save.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should not commit (save) anything in preview mode', async () => {
      const buf = await buildComponentsBuffer([
        ['COMP-001', null, null, 'PC', 'Không', null, null],
      ]);

      await service.importFromExcel(buf, 'preview');

      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });
});
