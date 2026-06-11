import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ExcelService } from '../common/excel/excel.service';
import { BomLine } from './bom-line.entity';
import { BomService } from './bom.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLine(
  id: number,
  parentCode: string,
  childCode: string,
  quantityPerUnit = 1,
): BomLine {
  const line = new BomLine();
  line.id = id;
  line.parentCode = parentCode;
  line.childCode = childCode;
  line.quantityPerUnit = quantityPerUnit;
  return line;
}

async function buildBomBuffer(
  rows: (string | number | null)[][],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow([
    'Material',
    'Material description',
    'Component',
    'Component description',
    'Quantity',
  ]);
  for (const row of rows) {
    ws.addRow(row);
  }
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}

// ── Mock setup ────────────────────────────────────────────────────────────────

const makeRepo = (lines: BomLine[] = []) => ({
  createQueryBuilder: jest.fn().mockReturnValue({
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(lines),
  }),
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue(lines),
  create: jest.fn((dto: any) => ({ ...dto })),
  save: jest.fn(async (e: any) => ({ id: Math.random(), ...e })),
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
        save: jest.fn(async (e: any) => ({ id: Math.random(), ...e })),
      }),
    };
    return cb(em);
  }),
});

function makeService(
  lines: BomLine[] = [],
  registeredCodes: string[] = [],
): BomService {
  const repo = makeRepo(lines);
  const componentsService = makeComponentsService(registeredCodes);
  const excelService = new ExcelService();
  const dataSource = makeDataSource();
  return new BomService(repo as any, componentsService as any, excelService, dataSource as any);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BomService', () => {

  // ── Cycle detection ─────────────────────────────────────────────────────────

  describe('detectCycle', () => {
    it('rejects direct cycle A→B then B→A with path message', () => {
      const service = makeService();
      const existingEdges = [makeLine(1, 'A', 'B')];
      // Adding B→A should detect cycle
      const path = service.detectCycle('B', 'A', existingEdges, 20);
      expect(path).not.toBeNull();
      expect(path!.join(' → ')).toContain('B');
      expect(path!.join(' → ')).toContain('A');
    });

    it('rejects deeper cycle A→B→C then C→A with path message', () => {
      const service = makeService();
      const existingEdges = [makeLine(1, 'A', 'B'), makeLine(2, 'B', 'C')];
      // Adding C→A should detect cycle
      const path = service.detectCycle('C', 'A', existingEdges, 20);
      expect(path).not.toBeNull();
      // Path should show the cycle
      expect(path!).toContain('C');
      expect(path!).toContain('A');
    });

    it('allows edge when no cycle exists', () => {
      const service = makeService();
      const existingEdges = [makeLine(1, 'A', 'B')];
      // Adding A→C is fine
      const path = service.detectCycle('A', 'C', existingEdges, 20);
      expect(path).toBeNull();
    });
  });

  // ── create ───────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('throws BadRequestException when parentCode === childCode', async () => {
      const service = makeService();
      await expect(
        service.create({ parentCode: 'A', childCode: 'A', quantityPerUnit: 2 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException on duplicate (parent, child) pair', async () => {
      const existingLine = makeLine(1, 'A', 'B');
      const service = makeService([existingLine]);
      // Override findOne to return the existing line
      const repo = (service as any).bomRepo;
      repo.findOne.mockResolvedValue(existingLine);

      await expect(
        service.create({ parentCode: 'A', childCode: 'B', quantityPerUnit: 1 }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException with cycle path when cycle would be created', async () => {
      const existingLine = makeLine(1, 'A', 'B');
      const service = makeService([existingLine]);
      const repo = (service as any).bomRepo;
      repo.findOne.mockResolvedValue(null); // no duplicate

      await expect(
        service.create({ parentCode: 'B', childCode: 'A', quantityPerUnit: 1 }),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.create({ parentCode: 'B', childCode: 'A', quantityPerUnit: 1 });
      } catch (e: any) {
        expect(e.message).toContain('BoM bị lặp vòng');
        expect(e.message).toContain('B');
        expect(e.message).toContain('A');
      }
    });
  });

  // ── update ───────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws NotFoundException when line not found', async () => {
      const service = makeService();
      const repo = (service as any).bomRepo;
      repo.findOne.mockResolvedValue(null);
      await expect(service.update(999, { quantityPerUnit: 5 })).rejects.toThrow(NotFoundException);
    });

    it('updates quantityPerUnit when found', async () => {
      const line = makeLine(1, 'A', 'B', 2);
      const service = makeService([line]);
      const repo = (service as any).bomRepo;
      repo.findOne.mockResolvedValue(line);
      repo.save.mockResolvedValue({ ...line, quantityPerUnit: 5 });

      const result = await service.update(1, { quantityPerUnit: 5 });
      expect(result.quantityPerUnit).toBe(5);
    });
  });

  // ── remove ───────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('throws NotFoundException when line not found', async () => {
      const service = makeService();
      const repo = (service as any).bomRepo;
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ── getTree ───────────────────────────────────────────────────────────────────

  describe('getTree', () => {
    it('returns 3-level tree with correct quantities and registered flags', async () => {
      // A (root) → B (qty=2) → C (qty=3)
      const edges = [
        makeLine(1, 'A', 'B', 2),
        makeLine(2, 'B', 'C', 3),
      ];
      // A and B are registered; C is not
      const service = makeService(edges, ['A', 'B']);

      const tree = await service.getTree('A');

      expect(tree.code).toBe('A');
      expect(tree.quantityPerUnit).toBe(1); // root always 1
      expect(tree.registered).toBe(true);
      expect(tree.children).toHaveLength(1);

      const nodeB = tree.children[0];
      expect(nodeB.code).toBe('B');
      expect(nodeB.quantityPerUnit).toBe(2);
      expect(nodeB.registered).toBe(true);
      expect(nodeB.children).toHaveLength(1);

      const nodeC = nodeB.children[0];
      expect(nodeC.code).toBe('C');
      expect(nodeC.quantityPerUnit).toBe(3);
      expect(nodeC.registered).toBe(false);
      expect(nodeC.children).toHaveLength(0);
    });
  });

  // ── getUnregisteredCodes ──────────────────────────────────────────────────────

  describe('getUnregisteredCodes', () => {
    it('returns codes used in bom_lines that have no matching component', async () => {
      const edges = [makeLine(1, 'A', 'X'), makeLine(2, 'B', 'Y')];
      // Only A and B are registered; X and Y are not
      const service = makeService(edges, ['A', 'B']);

      const unregistered = await service.getUnregisteredCodes();

      expect(unregistered).toContain('X');
      expect(unregistered).toContain('Y');
      expect(unregistered).not.toContain('A');
      expect(unregistered).not.toContain('B');
    });

    it('returns empty array when all codes are registered', async () => {
      const edges = [makeLine(1, 'A', 'B')];
      const service = makeService(edges, ['A', 'B']);

      const unregistered = await service.getUnregisteredCodes();
      expect(unregistered).toHaveLength(0);
    });
  });

  // ── importFromExcel ───────────────────────────────────────────────────────────

  describe('importFromExcel', () => {
    it('returns RowError when Quantity <= 0', async () => {
      const service = makeService([], []);
      const buf = await buildBomBuffer([
        ['MAT-A', null, 'COMP-B', null, 0],
      ]);

      const result = await service.importFromExcel(buf, 'preview');

      expect(result.errors.length).toBeGreaterThan(0);
      const qtyError = result.errors.find((e) => e.message === 'Số lượng phải lớn hơn 0');
      expect(qtyError).toBeDefined();
    });

    it('returns RowError when Material === Component', async () => {
      const service = makeService([], []);
      const buf = await buildBomBuffer([
        ['SAME', null, 'SAME', null, 2],
      ]);

      const result = await service.importFromExcel(buf, 'preview');

      expect(result.errors.length).toBeGreaterThan(0);
      const sameCodeError = result.errors.find(
        (e) => e.message === 'Mã cha và mã con không được trùng nhau',
      );
      expect(sameCodeError).toBeDefined();
    });

    it('issues warning (not error) for unregistered code', async () => {
      const service = makeService([], []); // no registered codes
      const buf = await buildBomBuffer([
        ['MAT-A', null, 'COMP-UNKNOWN', null, 2],
      ]);

      const result = await service.importFromExcel(buf, 'preview');

      expect(result.errors).toHaveLength(0);
      expect(result.warnings.some((w) => w.includes('COMP-UNKNOWN'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('MAT-A'))).toBe(true);
    });

    it('duplicate (Material, Component) pair in file — last row wins', async () => {
      const service = makeService([], []);
      const buf = await buildBomBuffer([
        ['MAT-A', null, 'COMP-B', null, 1],
        ['MAT-A', null, 'COMP-B', null, 5], // duplicate — last wins
      ]);

      const result = await service.importFromExcel(buf, 'preview');

      expect(result.valid).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('detects cycle in imported rows', async () => {
      // Existing: A→B. File tries to add B→A (cycle)
      const existingEdge = makeLine(1, 'A', 'B');
      const service = makeService([existingEdge], []);

      const buf = await buildBomBuffer([
        ['B', null, 'A', null, 2],
      ]);

      const result = await service.importFromExcel(buf, 'preview');

      expect(result.errors.some((e) => e.message.includes('BoM bị lặp vòng'))).toBe(true);
      expect(result.valid).toBe(0);
    });
  });
});
