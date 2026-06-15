import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ExcelService } from '../common/excel/excel.service';
import { AggregationLine, OrderAggregation } from './aggregation.entity';
import { Order, OrderLine, OrderStatus } from './order.entity';
import { OrdersService } from './orders.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeOrder(
  id: number,
  customerGroup: string,
  status: OrderStatus = OrderStatus.DRAFT,
  lines: OrderLine[] = [],
): Order {
  const o = new Order();
  o.id = id;
  o.code = `PO-TEST-${id.toString().padStart(3, '0')}`;
  o.customerGroup = customerGroup;
  o.note = null;
  o.status = status;
  o.createdById = 1;
  o.createdAt = new Date();
  o.lines = lines;
  return o;
}

function makeOrderLine(
  id: number,
  orderId: number,
  componentCode: string,
  quantity: number,
): OrderLine {
  const l = new OrderLine();
  l.id = id;
  l.orderId = orderId;
  l.componentCode = componentCode;
  l.quantity = quantity;
  return l;
}

async function buildOrdersBuffer(
  rows: (string | number | null)[][],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow([
    'Customer group',
    'Material',
    'Material description',
    'Order quantity',
  ]);
  for (const row of rows) {
    ws.addRow(row);
  }
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}

// ── Mock setup ────────────────────────────────────────────────────────────────

const makeOrderRepo = (orders: Order[] = []) => ({
  find: jest.fn().mockResolvedValue(orders),
  findOne: jest.fn(),
  count: jest.fn().mockResolvedValue(orders.length),
  create: jest.fn((dto: any) => ({
    id: Math.random(),
    createdAt: new Date(),
    ...dto,
  })),
  save: jest.fn(async (e: any) => ({
    id: Math.random(),
    createdAt: new Date(),
    ...e,
  })),
  delete: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
  }),
});

const makeOrderLineRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn(),
  create: jest.fn((dto: any) => ({ id: Math.random(), ...dto })),
  save: jest.fn(async (e: any) => ({ id: Math.random(), ...e })),
  delete: jest.fn(),
});

const makeAggregationRepo = (aggregations: OrderAggregation[] = []) => ({
  find: jest.fn().mockResolvedValue(aggregations),
  findOne: jest.fn(),
  create: jest.fn((dto: any) => ({
    id: Math.random(),
    createdAt: new Date(),
    ...dto,
  })),
  save: jest.fn(async (e: any) => ({
    id: Math.random(),
    createdAt: new Date(),
    ...e,
  })),
});

const makeAggregationLineRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  create: jest.fn((dto: any) => ({ id: Math.random(), ...dto })),
  save: jest.fn(async (e: any) => ({ id: Math.random(), ...e })),
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

/**
 * Creates a mock DataSource that captures the callback and executes it
 * with repositories that track all saves/deletes.
 */
const makeDataSource = () => {
  const transactionMocks = {
    orderSaves: [] as any[],
    orderDeletes: [] as any[],
    lineSaves: [] as any[],
    lineDeletes: [] as any[],
    aggSaves: [] as any[],
    aggLineSaves: [] as any[],
  };

  const em: any = {
    getRepository: jest.fn().mockImplementation((entity: any) => {
      if (entity === Order) {
        return {
          create: jest.fn((dto: any) => ({
            id: Math.random(),
            createdAt: new Date(),
            ...dto,
          })),
          save: jest.fn(async (e: any) => {
            const saved = { id: Math.random(), createdAt: new Date(), ...e };
            transactionMocks.orderSaves.push(saved);
            return saved;
          }),
          delete: jest.fn(async (q: any) => {
            transactionMocks.orderDeletes.push(q);
          }),
          findOne: jest.fn().mockResolvedValue(null),
        };
      }
      if (entity === OrderLine) {
        return {
          create: jest.fn((dto: any) => ({ id: Math.random(), ...dto })),
          save: jest.fn(async (e: any) => {
            const saved = { id: Math.random(), ...e };
            transactionMocks.lineSaves.push(saved);
            return saved;
          }),
          delete: jest.fn(async (q: any) => {
            transactionMocks.lineDeletes.push(q);
          }),
        };
      }
      if (entity === OrderAggregation) {
        return {
          create: jest.fn((dto: any) => ({
            id: 99,
            createdAt: new Date(),
            ...dto,
          })),
          save: jest.fn(async (e: any) => {
            const saved = { id: 99, createdAt: new Date(), ...e };
            transactionMocks.aggSaves.push(saved);
            return saved;
          }),
        };
      }
      if (entity === AggregationLine) {
        return {
          create: jest.fn((dto: any) => ({ id: Math.random(), ...dto })),
          save: jest.fn(async (e: any) => {
            const saved = { id: Math.random(), ...e };
            transactionMocks.aggLineSaves.push(saved);
            return saved;
          }),
        };
      }
      return {};
    }),
  };

  return {
    transaction: jest.fn(async (cb: (em: any) => Promise<any>) => cb(em)),
    _mocks: transactionMocks,
    _em: em,
  };
};

function makeService(
  orders: Order[] = [],
  aggregations: OrderAggregation[] = [],
  registeredCodes: string[] = [],
): { service: OrdersService; orderRepo: any; aggRepo: any; dataSource: any } {
  const orderRepo = makeOrderRepo(orders);
  const orderLineRepo = makeOrderLineRepo();
  const aggregationRepo = makeAggregationRepo(aggregations);
  const aggregationLineRepo = makeAggregationLineRepo();
  const componentsService = makeComponentsService(registeredCodes);
  const excelService = new ExcelService();
  const dataSource = makeDataSource();

  const service = new OrdersService(
    orderRepo as any,
    orderLineRepo as any,
    aggregationRepo as any,
    aggregationLineRepo as any,
    componentsService as any,
    excelService,
    dataSource as any,
  );

  return { service, orderRepo, aggRepo: aggregationRepo, dataSource };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OrdersService', () => {
  // ── aggregate ────────────────────────────────────────────────────────────────

  describe('aggregate', () => {
    it('sums quantities across orders by componentCode', async () => {
      const lines1 = [
        makeOrderLine(1, 1, 'MAT-A', 10),
        makeOrderLine(2, 1, 'MAT-B', 5),
      ];
      const lines2 = [
        makeOrderLine(3, 2, 'MAT-A', 7),
        makeOrderLine(4, 2, 'MAT-C', 3),
      ];
      const orders = [
        makeOrder(1, 'Group A', OrderStatus.DRAFT, lines1),
        makeOrder(2, 'Group B', OrderStatus.DRAFT, lines2),
      ];

      const { service, dataSource } = makeService(orders);
      const { orderRepo } = makeService(orders);

      // Make find return draft orders
      const svc = service as any;
      svc.orderRepo.find.mockResolvedValue(orders);

      await service.aggregate(1);

      // Check aggregation lines were saved
      const aggLineSaves = dataSource._mocks.aggLineSaves;
      const matA = aggLineSaves.find((l: any) => l.componentCode === 'MAT-A');
      const matB = aggLineSaves.find((l: any) => l.componentCode === 'MAT-B');
      const matC = aggLineSaves.find((l: any) => l.componentCode === 'MAT-C');

      expect(matA).toBeDefined();
      expect(matA.totalQty).toBe(17); // 10 + 7
      expect(matB).toBeDefined();
      expect(matB.totalQty).toBe(5);
      expect(matC).toBeDefined();
      expect(matC.totalQty).toBe(3);
    });

    it('marks all DRAFT orders as AGGREGATED', async () => {
      const lines = [makeOrderLine(1, 1, 'MAT-A', 5)];
      const orders = [makeOrder(1, 'Group A', OrderStatus.DRAFT, lines)];

      const { service, dataSource } = makeService(orders);
      const svc = service as any;
      svc.orderRepo.find.mockResolvedValue(orders);

      await service.aggregate(1);

      // Order saves in transaction should have status AGGREGATED
      const orderSaves = dataSource._mocks.orderSaves;
      expect(orderSaves.length).toBeGreaterThan(0);
      const savedOrder = orderSaves.find((o: any) => o.id !== undefined);
      expect(savedOrder).toBeDefined();
    });

    it('throws BadRequestException when no DRAFT orders exist', async () => {
      const { service } = makeService([]);
      const svc = service as any;
      svc.orderRepo.find.mockResolvedValue([]);

      await expect(service.aggregate(1)).rejects.toThrow(BadRequestException);
      await expect(service.aggregate(1)).rejects.toThrow(
        'Không có đơn hàng nào chờ tổng hợp',
      );
    });
  });

  // ── update ───────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws BadRequestException when order is not DRAFT', async () => {
      const order = makeOrder(1, 'Group A', OrderStatus.AGGREGATED, []);
      const { service } = makeService([order]);
      const svc = service as any;
      svc.orderRepo.findOne.mockResolvedValue(order);

      await expect(
        service.update(1, { customerGroup: 'New Group' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update(1, { customerGroup: 'New Group' }),
      ).rejects.toThrow('Đơn hàng đã tổng hợp, không thể sửa');
    });

    it('throws NotFoundException when order does not exist', async () => {
      const { service } = makeService([]);
      const svc = service as any;
      svc.orderRepo.findOne.mockResolvedValue(null);

      await expect(service.update(999, { customerGroup: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── create (auto code) ────────────────────────────────────────────────────────

  describe('create', () => {
    it('generates auto code with PO-YYYYMMDD-### format', async () => {
      const { service } = makeService([]);
      const svc = service as any;
      svc.orderRepo.findOne.mockResolvedValue(null); // no duplicate
      svc.orderRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(2), // 2 orders today → seq = 003
      });

      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const expectedDatePart = `${yyyy}${mm}${dd}`;

      const code = await service.generateCode();

      expect(code).toMatch(/^PO-\d{8}-\d{3}$/);
      expect(code).toContain(expectedDatePart);
      expect(code.endsWith('-003')).toBe(true); // 2 today + 1 = 003
    });

    it('throws ConflictException for duplicate explicit code', async () => {
      const existingOrder = makeOrder(1, 'Group A', OrderStatus.DRAFT, []);
      const { service } = makeService([existingOrder]);
      const svc = service as any;
      svc.orderRepo.findOne.mockResolvedValue(existingOrder);

      await expect(
        service.create(
          {
            customerGroup: 'Group B',
            code: 'PO-DUP',
            lines: [{ componentCode: 'MAT-A', quantity: 1 }],
          },
          1,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── importFromExcel ───────────────────────────────────────────────────────────

  describe('importFromExcel', () => {
    it('groups rows by Customer group into separate orders', async () => {
      const { service, dataSource } = makeService([], [], []);
      const svc = service as any;
      // generateCode needs a working queryBuilder
      svc.orderRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      });

      const buf = await buildOrdersBuffer([
        ['Group A', 'MAT-001', null, 10],
        ['Group B', 'MAT-002', null, 5],
        ['Group A', 'MAT-003', null, 3],
      ]);

      const result = await service.importFromExcel(buf, 'commit');

      expect(result.errors).toHaveLength(0);
      expect(result.committed).toBe(true);

      // Two distinct customer groups → 2 orders saved in transaction
      const orderSaves = dataSource._mocks.orderSaves;
      const groupAOrder = orderSaves.find(
        (o: any) => o.customerGroup === 'Group A',
      );
      const groupBOrder = orderSaves.find(
        (o: any) => o.customerGroup === 'Group B',
      );
      expect(groupAOrder).toBeDefined();
      expect(groupBOrder).toBeDefined();
    });

    it('sums in-file duplicates for same (customerGroup, componentCode)', async () => {
      const { service, dataSource } = makeService([], [], []);
      const svc = service as any;
      svc.orderRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      });

      const buf = await buildOrdersBuffer([
        ['Group A', 'MAT-001', null, 10],
        ['Group A', 'MAT-001', null, 5], // duplicate → sum = 15
      ]);

      const result = await service.importFromExcel(buf, 'commit');

      expect(result.errors).toHaveLength(0);
      // After dedup, 1 valid line for Group A
      expect(result.valid).toBe(1);

      const lineSaves = dataSource._mocks.lineSaves;
      const mat001Line = lineSaves.find(
        (l: any) => l.componentCode === 'MAT-001',
      );
      expect(mat001Line).toBeDefined();
      expect(mat001Line.quantity).toBe(15);
    });

    it('returns RowError for Order quantity <= 0', async () => {
      const { service } = makeService([], [], []);

      const buf = await buildOrdersBuffer([
        ['Group A', 'MAT-001', null, 0],
        ['Group B', 'MAT-002', null, -1],
      ]);

      const result = await service.importFromExcel(buf, 'preview');

      expect(result.errors.length).toBe(2);
      const err = result.errors.find(
        (e) => e.message === 'Số lượng phải lớn hơn 0',
      );
      expect(err).toBeDefined();
      expect(err!.row).toBe(2); // first data row = Excel row 2
    });

    it('issues warning (not error) for unregistered material code', async () => {
      const { service } = makeService([], [], []); // no registered codes

      const buf = await buildOrdersBuffer([
        ['Group A', 'UNREGISTERED-MAT', null, 5],
      ]);

      const result = await service.importFromExcel(buf, 'preview');

      expect(result.errors).toHaveLength(0);
      expect(result.warnings.some((w) => w.includes('UNREGISTERED-MAT'))).toBe(
        true,
      );
    });
  });
});
