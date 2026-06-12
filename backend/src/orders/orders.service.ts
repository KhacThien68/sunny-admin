import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ExcelService, RowError, SheetSpec } from '../common/excel/excel.service';
import { ComponentsService } from '../components/components.service';
import { AggregationLine, OrderAggregation } from './aggregation.entity';
import { CreateOrderDto, UpdateOrderDto } from './dto/order.dto';
import { Order, OrderLine, OrderStatus } from './order.entity';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface OrderLineWithFlags extends OrderLine {
  registered: boolean;
  description: string | null;
}

export interface OrderWithLineCount {
  id: number;
  code: string;
  customerGroup: string;
  note: string | null;
  status: OrderStatus;
  createdById: number;
  createdAt: Date;
  lineCount: number;
}

export interface AggregationWithLineCount {
  id: number;
  createdById: number;
  createdAt: Date;
  lineCount: number;
}

export interface AggregationLineWithFlags extends AggregationLine {
  registered: boolean;
  description: string | null;
}

export interface AggregationWithLines extends OrderAggregation {
  lines: AggregationLineWithFlags[];
}

export interface OrderImportResult {
  valid: number;
  errors: RowError[];
  warnings: string[];
  committed: boolean;
}

// ── Excel spec ────────────────────────────────────────────────────────────────

const ORDERS_SPEC: SheetSpec = {
  columns: [
    { header: 'Customer group', key: 'customerGroup', required: true, type: 'string' },
    { header: 'Material', key: 'componentCode', required: true, type: 'string' },
    { header: 'Material description', key: 'materialDescription', required: false, type: 'string' },
    { header: 'Order quantity', key: 'quantity', required: true, type: 'number' },
  ],
};

interface ParsedOrderRow {
  customerGroup: string;
  componentCode: string;
  quantity: number;
  __row: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderLine)
    private readonly orderLineRepo: Repository<OrderLine>,
    @InjectRepository(OrderAggregation)
    private readonly aggregationRepo: Repository<OrderAggregation>,
    @InjectRepository(AggregationLine)
    private readonly aggregationLineRepo: Repository<AggregationLine>,
    private readonly componentsService: ComponentsService,
    private readonly excelService: ExcelService,
    private readonly dataSource: DataSource,
  ) {}

  // ────────────────────────────────────────────────────────────────────────────
  //  Read
  // ────────────────────────────────────────────────────────────────────────────

  async findAll(): Promise<OrderWithLineCount[]> {
    const orders = await this.orderRepo.find({
      relations: { lines: true },
      order: { createdAt: 'DESC' },
    });

    return orders.map((o) => ({
      id: o.id,
      code: o.code,
      customerGroup: o.customerGroup,
      note: o.note,
      status: o.status,
      createdById: o.createdById,
      createdAt: o.createdAt,
      lineCount: o.lines?.length ?? 0,
    }));
  }

  async findOne(id: number): Promise<Order & { lines: OrderLineWithFlags[] }> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: { lines: true },
    });
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    const lines = order.lines ?? [];
    const allCodes = lines.map((l) => l.componentCode);
    const codeMap = allCodes.length > 0
      ? await this.componentsService.getCodeMap(allCodes)
      : new Map();

    const linesWithFlags: OrderLineWithFlags[] = lines.map((l) => ({
      ...l,
      registered: codeMap.has(l.componentCode),
      description: codeMap.get(l.componentCode)?.description ?? null,
    }));

    return { ...order, lines: linesWithFlags };
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  Create
  // ────────────────────────────────────────────────────────────────────────────

  async create(dto: CreateOrderDto, userId: number): Promise<Order> {
    // Duplicate code check
    if (dto.code) {
      const existing = await this.orderRepo.findOne({ where: { code: dto.code } });
      if (existing) {
        throw new ConflictException('Mã đơn hàng đã tồn tại');
      }
    }

    const code = dto.code ?? (await this.generateCode());

    const order = this.orderRepo.create({
      code,
      customerGroup: dto.customerGroup,
      note: dto.note ?? null,
      status: OrderStatus.DRAFT,
      createdById: userId,
      lines: dto.lines.map((l) =>
        this.orderLineRepo.create({
          componentCode: l.componentCode,
          quantity: l.quantity,
        }),
      ),
    });

    return this.orderRepo.save(order);
  }

  async generateCode(): Promise<string> {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayCount = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.createdAt >= :start AND o.createdAt <= :end', {
        start: startOfDay,
        end: endOfDay,
      })
      .getCount();

    const seq = String(todayCount + 1).padStart(3, '0');
    return `PO-${dateStr}-${seq}`;
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  Update
  // ────────────────────────────────────────────────────────────────────────────

  async update(id: number, dto: UpdateOrderDto): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: { lines: true },
    });
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }
    if (order.status !== OrderStatus.DRAFT) {
      throw new BadRequestException('Đơn hàng đã tổng hợp, không thể sửa');
    }

    if (dto.code && dto.code !== order.code) {
      const existing = await this.orderRepo.findOne({ where: { code: dto.code } });
      if (existing) {
        throw new ConflictException('Mã đơn hàng đã tồn tại');
      }
    }

    return this.dataSource.transaction(async (em: EntityManager) => {
      const orderEm = em.getRepository(Order);
      const lineEm = em.getRepository(OrderLine);

      if (dto.customerGroup !== undefined) order.customerGroup = dto.customerGroup;
      if (dto.note !== undefined) order.note = dto.note ?? null;
      if (dto.code !== undefined) order.code = dto.code;

      if (dto.lines !== undefined) {
        // Delete old lines then insert new
        await lineEm.delete({ orderId: id });
        order.lines = dto.lines.map((l) =>
          lineEm.create({
            orderId: id,
            componentCode: l.componentCode,
            quantity: l.quantity,
          }),
        );
        await lineEm.save(order.lines);
      }

      return orderEm.save(order);
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  Remove
  // ────────────────────────────────────────────────────────────────────────────

  async remove(id: number): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }
    if (order.status !== OrderStatus.DRAFT) {
      throw new BadRequestException('Đơn hàng đã tổng hợp, không thể xóa');
    }
    await this.orderRepo.delete(id);
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  Aggregate
  // ────────────────────────────────────────────────────────────────────────────

  async aggregate(userId: number): Promise<OrderAggregation & { lines: AggregationLine[] }> {
    const draftOrders = await this.orderRepo.find({
      where: { status: OrderStatus.DRAFT },
      relations: { lines: true },
    });

    if (draftOrders.length === 0) {
      throw new BadRequestException('Không có đơn hàng nào chờ tổng hợp');
    }

    // Sum by componentCode
    const sumMap = new Map<string, number>();
    for (const order of draftOrders) {
      for (const line of order.lines ?? []) {
        const current = sumMap.get(line.componentCode) ?? 0;
        sumMap.set(line.componentCode, current + line.quantity);
      }
    }

    return this.dataSource.transaction(async (em: EntityManager) => {
      const aggRepo = em.getRepository(OrderAggregation);
      const aggLineRepo = em.getRepository(AggregationLine);
      const orderRepo = em.getRepository(Order);

      // Create aggregation
      const aggregation = aggRepo.create({ createdById: userId });
      const savedAgg = await aggRepo.save(aggregation);

      // Create aggregation lines
      const aggLines: AggregationLine[] = [];
      for (const [componentCode, totalQty] of sumMap.entries()) {
        const line = aggLineRepo.create({
          aggregationId: savedAgg.id,
          componentCode,
          totalQty,
        });
        aggLines.push(await aggLineRepo.save(line));
      }

      // Mark orders as AGGREGATED
      for (const order of draftOrders) {
        order.status = OrderStatus.AGGREGATED;
        await orderRepo.save(order);
      }

      savedAgg.lines = aggLines;
      return savedAgg;
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  Aggregation reads
  // ────────────────────────────────────────────────────────────────────────────

  async getAggregations(): Promise<AggregationWithLineCount[]> {
    const aggregations = await this.aggregationRepo.find({
      relations: { lines: true },
      order: { createdAt: 'DESC' },
    });

    return aggregations.map((a) => ({
      id: a.id,
      createdById: a.createdById,
      createdAt: a.createdAt,
      lineCount: a.lines?.length ?? 0,
    }));
  }

  async getLatestAggregation(): Promise<AggregationWithLines> {
    const aggregation = await this.aggregationRepo.findOne({
      where: {},
      relations: { lines: true },
      order: { createdAt: 'DESC' },
    });

    if (!aggregation) {
      throw new NotFoundException('Chưa có lần tổng hợp nào');
    }

    const lines = aggregation.lines ?? [];
    const allCodes = lines.map((l) => l.componentCode);
    const codeMap = allCodes.length > 0
      ? await this.componentsService.getCodeMap(allCodes)
      : new Map();

    const linesWithFlags: AggregationLineWithFlags[] = lines.map((l) => ({
      ...l,
      registered: codeMap.has(l.componentCode),
      description: codeMap.get(l.componentCode)?.description ?? null,
    }));

    return { ...aggregation, lines: linesWithFlags };
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  Import
  // ────────────────────────────────────────────────────────────────────────────

  async buildImportTemplate(): Promise<Buffer> {
    return this.excelService.buildTemplate(ORDERS_SPEC);
  }

  async importFromExcel(
    buffer: Buffer,
    mode: 'preview' | 'commit',
  ): Promise<OrderImportResult> {
    const parsed = await this.excelService.parse<Record<string, unknown>>(buffer, ORDERS_SPEC);

    const allErrors: RowError[] = [...parsed.errors];
    const warnings: string[] = [];

    const domainValidRows: ParsedOrderRow[] = [];

    for (const row of parsed.rows) {
      const customerGroup = row['customerGroup'] as string;
      const componentCode = row['componentCode'] as string;
      const qty = row['quantity'] as number;
      const excelRow = row['__row'] as number;

      if (qty <= 0) {
        allErrors.push({
          row: excelRow,
          column: 'Order quantity',
          message: 'Số lượng phải lớn hơn 0',
        });
        continue;
      }

      domainValidRows.push({ customerGroup, componentCode, quantity: qty, __row: excelRow });
    }

    // Group by customerGroup; sum quantities for same (customerGroup, componentCode)
    // Map: customerGroup → Map<componentCode, { qty, __row }>
    const groupMap = new Map<string, Map<string, { quantity: number; __row: number }>>();

    for (const row of domainValidRows) {
      if (!groupMap.has(row.customerGroup)) {
        groupMap.set(row.customerGroup, new Map());
      }
      const codeMap = groupMap.get(row.customerGroup)!;
      if (codeMap.has(row.componentCode)) {
        const existing = codeMap.get(row.componentCode)!;
        existing.quantity += row.quantity;
      } else {
        codeMap.set(row.componentCode, { quantity: row.quantity, __row: row.__row });
      }
    }

    // Count total valid rows (deduped lines across all orders)
    let validCount = 0;
    for (const codeMap of groupMap.values()) {
      validCount += codeMap.size;
    }

    // Collect unregistered codes as warnings
    const allCodesInFile = new Set(domainValidRows.map((r) => r.componentCode));
    if (allCodesInFile.size > 0) {
      const codeMapRes = await this.componentsService.getCodeMap([...allCodesInFile]);
      for (const code of allCodesInFile) {
        if (!codeMapRes.has(code)) {
          warnings.push(`Mã ${code} chưa được khai báo tại Quản lý mã`);
        }
      }
    }

    if (mode === 'commit' && groupMap.size > 0) {
      await this.dataSource.transaction(async (em: EntityManager) => {
        const orderRepo = em.getRepository(Order);
        const lineRepo = em.getRepository(OrderLine);

        for (const [customerGroup, codeMap] of groupMap.entries()) {
          const code = await this.generateCode();

          const order = orderRepo.create({
            code,
            customerGroup,
            note: null,
            status: OrderStatus.DRAFT,
            createdById: 0, // system import
          });
          const savedOrder = await orderRepo.save(order);

          for (const [componentCode, { quantity }] of codeMap.entries()) {
            const line = lineRepo.create({
              orderId: savedOrder.id,
              componentCode,
              quantity,
            });
            await lineRepo.save(line);
          }
        }
      });
    }

    return {
      valid: validCount,
      errors: allErrors,
      warnings,
      committed: mode === 'commit',
    };
  }
}
