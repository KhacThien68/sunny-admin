import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BomService } from '../bom/bom.service';
import { ComponentsService } from '../components/components.service';
import { EngineComponent } from './engine/mrp-engine';
import {
  applyPurchaseEdit,
  computeRound,
  explodeNextDemands,
  isFinished,
} from './engine/mrp-engine';
import { MrpLine, MrpRun, MrpRunStatus } from './mrp-run.entity';
import { OnhandService } from '../onhand/onhand.service';
import { OrdersService } from '../orders/orders.service';
import { UsersService } from '../users/users.service';

// ── Shapes ─────────────────────────────────────────────────────────────────

export interface LineWithMeta extends MrpLine {
  description: string | null;
  uom: string | null;
  mob: string;
  moq: number;
}

export interface RoundGroup {
  round: number;
  locked: boolean;
  lines: LineWithMeta[];
}

export interface RunDetail {
  run: MrpRun;
  rounds: RoundGroup[];
}

export interface CreateRunResult {
  run: MrpRun;
  lines: MrpLine[];
  warnings: string[];
}

export interface RunListItem {
  id: number;
  aggregationId: number;
  status: MrpRunStatus;
  currentRound: number;
  createdById: number;
  createdByName: string | null;
  createdAt: Date;
}

// ── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class MrpService {
  constructor(
    @InjectRepository(MrpRun)
    private readonly runRepo: Repository<MrpRun>,
    @InjectRepository(MrpLine)
    private readonly lineRepo: Repository<MrpLine>,
    private readonly ordersService: OrdersService,
    private readonly componentsService: ComponentsService,
    private readonly onhandService: OnhandService,
    private readonly bomService: BomService,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  // ── createRun ──────────────────────────────────────────────────────────────

  async createRun(userId: number): Promise<CreateRunResult> {
    // 1. Load latest aggregation (throws NotFoundException if none)
    const aggregation = await this.ordersService.getLatestAggregation();

    const aggCodes = aggregation.lines.map((l) => l.componentCode);

    // 2. Validate all codes registered in components
    const codeMap = aggCodes.length > 0
      ? await this.componentsService.getCodeMap(aggCodes)
      : new Map();

    const missingCodes = aggCodes.filter((c) => !codeMap.has(c));
    if (missingCodes.length > 0) {
      throw new BadRequestException(
        `Các mã chưa khai báo: ${missingCodes.join(', ')}`,
      );
    }

    // 3. Build warnings for codes without BoM edges
    const allEdges = await this.bomService.getAllEdges();
    const parentCodes = new Set(allEdges.map((e) => e.parentCode));
    const warnings: string[] = [];
    for (const code of aggCodes) {
      const comp = codeMap.get(code)!;
      if (!parentCodes.has(code) && comp.mob !== 'BAT_BUOC') {
        warnings.push(`Mã ${code} không có BoM`);
      }
    }

    // 4. Build demands for round 1
    const demands = aggregation.lines.map((l) => ({
      code: l.componentCode,
      orderQty: l.totalQty,
    }));

    // 5. Fetch initial onhand for all codes in demand
    const initialOnhand = await this.onhandService.getQuantityMap(aggCodes);

    // 6. Build engine components map
    const engineComponents = new Map<string, EngineComponent>(
      aggCodes.map((code) => {
        const c = codeMap.get(code)!;
        return [
          code,
          {
            code: c.code,
            mob: c.mob as EngineComponent['mob'],
            moq: c.moq,
            inventoryLevel: c.inventoryLevel,
          },
        ];
      }),
    );

    // 7. Compute round 1
    const engineLines = computeRound(
      demands,
      engineComponents,
      initialOnhand,
      new Map(),
      new Set(),
    );

    // 8. Persist in transaction
    const result = await this.dataSource.transaction(async (em: EntityManager) => {
      const runEm = em.getRepository(MrpRun);
      const lineEm = em.getRepository(MrpLine);

      const run = runEm.create({
        aggregationId: aggregation.id,
        status: MrpRunStatus.RUNNING,
        currentRound: 1,
        createdById: userId,
      });
      const savedRun = await runEm.save(run);

      const lines: MrpLine[] = [];
      for (const el of engineLines) {
        const line = lineEm.create({
          runId: savedRun.id,
          round: 1,
          componentCode: el.code,
          orderQty: el.orderQty,
          onhand: el.onhand,
          levels: el.levels,
          demand: el.demand,
          purchase: el.purchase,
          manufacturing: el.manufacturing,
          recovery: el.recovery,
          locked: false,
        });
        lines.push(await lineEm.save(line));
      }

      return { run: savedRun, lines };
    });

    return { ...result, warnings };
  }

  // ── getRuns ────────────────────────────────────────────────────────────────

  async getRuns(): Promise<RunListItem[]> {
    const runs = await this.runRepo.find({ order: { createdAt: 'DESC' } });
    if (runs.length === 0) return [];

    const users = await this.usersService.findAll();
    const userMap = new Map(users.map((u) => [u.id, u.name ?? u.email]));

    return runs.map((r) => ({
      id: r.id,
      aggregationId: r.aggregationId,
      status: r.status,
      currentRound: r.currentRound,
      createdById: r.createdById,
      createdByName: userMap.get(r.createdById) ?? null,
      createdAt: r.createdAt,
    }));
  }

  // ── getRun ─────────────────────────────────────────────────────────────────

  async getRun(id: number): Promise<RunDetail> {
    const run = await this.runRepo.findOne({ where: { id } });
    if (!run) throw new NotFoundException('Không tìm thấy phiên MRP');

    const lines = await this.lineRepo.find({
      where: { runId: id },
      order: { round: 'ASC', id: 'ASC' },
    });

    const allCodes = [...new Set(lines.map((l) => l.componentCode))];
    const codeMap = allCodes.length > 0
      ? await this.componentsService.getCodeMap(allCodes)
      : new Map();

    // Group by round
    const roundMap = new Map<number, MrpLine[]>();
    for (const line of lines) {
      if (!roundMap.has(line.round)) roundMap.set(line.round, []);
      roundMap.get(line.round)!.push(line);
    }

    const rounds: RoundGroup[] = [];
    for (const [round, roundLines] of roundMap.entries()) {
      const linesWithMeta: LineWithMeta[] = roundLines.map((l) => {
        const comp = codeMap.get(l.componentCode);
        return {
          ...l,
          description: comp?.description ?? null,
          uom: comp?.uom ?? null,
          mob: comp?.mob ?? 'KHONG',
          moq: comp?.moq ?? 0,
        };
      });

      rounds.push({
        round,
        locked: roundLines.every((l) => l.locked),
        lines: linesWithMeta,
      });
    }

    return { run, rounds };
  }

  // ── updateLine ─────────────────────────────────────────────────────────────

  async updateLine(
    runId: number,
    lineId: number,
    purchase: number,
  ): Promise<MrpLine> {
    const run = await this.runRepo.findOne({ where: { id: runId } });
    if (!run) throw new NotFoundException('Không tìm thấy phiên MRP');

    if (run.status !== MrpRunStatus.RUNNING) {
      throw new BadRequestException('Phiên đã hoàn tất');
    }

    const line = await this.lineRepo.findOne({ where: { id: lineId, runId } });
    if (!line) throw new NotFoundException('Không tìm thấy dòng MRP');

    if (line.round !== run.currentRound) {
      throw new BadRequestException('Chỉ được sửa vòng hiện tại');
    }

    if (line.locked) {
      throw new BadRequestException('Dòng đã bị khoá');
    }

    const comp = await this.componentsService.findByCode(line.componentCode);
    if (!comp) throw new NotFoundException('Không tìm thấy mã thành phần');

    const engineComp: EngineComponent = {
      code: comp.code,
      mob: comp.mob as EngineComponent['mob'],
      moq: comp.moq,
      inventoryLevel: comp.inventoryLevel,
    };

    // Engine validates and throws on violation
    let updated: ReturnType<typeof applyPurchaseEdit>;
    try {
      updated = applyPurchaseEdit(
        {
          code: line.componentCode,
          orderQty: line.orderQty,
          onhand: line.onhand,
          levels: line.levels,
          demand: line.demand,
          purchase: line.purchase,
          manufacturing: line.manufacturing,
          recovery: line.recovery,
        },
        purchase,
        engineComp,
      );
    } catch (err: unknown) {
      throw new BadRequestException((err as Error).message);
    }

    line.purchase = updated.purchase;
    line.manufacturing = updated.manufacturing;
    return this.lineRepo.save(line);
  }

  // ── closeRound ─────────────────────────────────────────────────────────────

  async closeRound(runId: number): Promise<RunDetail> {
    const run = await this.runRepo.findOne({ where: { id: runId } });
    if (!run) throw new NotFoundException('Không tìm thấy phiên MRP');

    if (run.status !== MrpRunStatus.RUNNING) {
      throw new BadRequestException('Phiên đã hoàn tất');
    }

    const currentRoundLines = await this.lineRepo.find({
      where: { runId, round: run.currentRound },
    });

    // Get all edges for explode
    const allEdges = await this.bomService.getAllEdges();

    // Convert MrpLine[] to EngineLine[] for engine functions
    const toEngineLines = (lines: MrpLine[]): import('./engine/mrp-engine').EngineLine[] =>
      lines.map((l) => ({
        code: l.componentCode,
        orderQty: l.orderQty,
        onhand: l.onhand,
        levels: l.levels,
        demand: l.demand,
        purchase: l.purchase,
        manufacturing: l.manufacturing,
        recovery: l.recovery,
      }));

    // Explode current round → next demands
    const nextDemands = explodeNextDemands(toEngineLines(currentRoundLines), allEdges);

    await this.dataSource.transaction(async (em: EntityManager) => {
      const runEm = em.getRepository(MrpRun);
      const lineEm = em.getRepository(MrpLine);

      // Lock current round lines
      await lineEm.update({ runId, round: run.currentRound }, { locked: true });

      // Check finish conditions
      if (nextDemands.length === 0 || isFinished(toEngineLines(currentRoundLines), run.currentRound)) {
        run.status = MrpRunStatus.DONE;
        await runEm.save(run);
        return;
      }

      // Validate next round codes
      const nextCodes = nextDemands.map((d) => d.code);
      const codeMap = await this.componentsService.getCodeMap(nextCodes);
      const missingCodes = nextCodes.filter((c) => !codeMap.has(c));
      if (missingCodes.length > 0) {
        throw new BadRequestException(
          `Các mã chưa khai báo: ${missingCodes.join(', ')}`,
        );
      }

      // Build purchasedBefore: sum of purchase per code across all locked rounds
      const allLockedLines = await lineEm.find({ where: { runId, locked: true } });
      const purchasedBefore = new Map<string, number>();
      for (const l of allLockedLines) {
        purchasedBefore.set(
          l.componentCode,
          (purchasedBefore.get(l.componentCode) ?? 0) + l.purchase,
        );
      }

      // Build demandedBefore: codes with demand > 0 in any previous round
      const demandedBefore = new Set<string>(
        allLockedLines.filter((l) => l.demand > 0).map((l) => l.componentCode),
      );

      // Fetch initial onhand for next round codes
      const initialOnhand = await this.onhandService.getQuantityMap(nextCodes);

      // Build engine components map for next round
      const engineComponents = new Map<string, EngineComponent>(
        nextCodes.map((code) => {
          const c = codeMap.get(code)!;
          return [
            code,
            {
              code: c.code,
              mob: c.mob as EngineComponent['mob'],
              moq: c.moq,
              inventoryLevel: c.inventoryLevel,
            },
          ];
        }),
      );

      // Compute next round
      const nextRound = run.currentRound + 1;
      const nextLines = computeRound(
        nextDemands,
        engineComponents,
        initialOnhand,
        purchasedBefore,
        demandedBefore,
      );

      // Persist next round lines
      for (const el of nextLines) {
        const line = lineEm.create({
          runId,
          round: nextRound,
          componentCode: el.code,
          orderQty: el.orderQty,
          onhand: el.onhand,
          levels: el.levels,
          demand: el.demand,
          purchase: el.purchase,
          manufacturing: el.manufacturing,
          recovery: el.recovery,
          locked: false,
        });
        await lineEm.save(line);
      }

      // Check if the newly computed round is already finished
      if (isFinished(nextLines, nextRound)) {
        // Lock next round lines too and mark DONE
        await lineEm.update({ runId, round: nextRound }, { locked: true });
        run.status = MrpRunStatus.DONE;
        run.currentRound = nextRound;
      } else {
        run.currentRound = nextRound;
      }

      await runEm.save(run);
    });

    // Reload run after transaction
    const updatedRun = await this.runRepo.findOne({ where: { id: runId } });
    return this.getRun(updatedRun!.id);
  }
}
