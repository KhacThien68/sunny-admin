import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComponentsService } from '../components/components.service';
import { MrpLine, MrpRun, MrpRunStatus } from '../mrp/mrp-run.entity';
import { OnhandService } from '../onhand/onhand.service';

// ── Shapes ────────────────────────────────────────────────────────────────────

export interface SummaryRunInfo {
  id: number;
  status: MrpRunStatus;
  createdAt: Date;
  rounds: number[];
}

export interface PurchaseItem {
  code: string;
  classification: string | null;
  description: string | null;
  uom: string | null;
  total: number;
  rounds: Record<number, number>;
}

export interface PurchaseSummaryResult {
  run: SummaryRunInfo;
  items: PurchaseItem[];
}

export interface PsiItem {
  code: string;
  classification: string | null;
  description: string | null;
  uom: string | null;
  onhand: number;
  purchase: number;
  sale: number;
  closing: number;
}

export interface PsiResult {
  run: SummaryRunInfo;
  items: PsiItem[];
}

export interface RunListItem {
  id: number;
  status: MrpRunStatus;
  createdAt: Date;
  currentRound: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class OutputsService {
  constructor(
    @InjectRepository(MrpRun)
    private readonly runRepo: Repository<MrpRun>,
    @InjectRepository(MrpLine)
    private readonly lineRepo: Repository<MrpLine>,
    private readonly componentsService: ComponentsService,
    private readonly onhandService: OnhandService,
  ) {}

  // ── resolveRun ──────────────────────────────────────────────────────────────

  async resolveRun(runId?: number): Promise<MrpRun> {
    if (runId !== undefined) {
      const run = await this.runRepo.findOne({ where: { id: runId } });
      if (!run) throw new NotFoundException('Không tìm thấy phiên chạy');
      return run;
    }

    // Latest DONE run
    const doneRun = await this.runRepo.findOne({
      where: { status: MrpRunStatus.DONE },
      order: { createdAt: 'DESC' },
    });
    if (doneRun) return doneRun;

    // Any latest run
    const anyRun = await this.runRepo.findOne({
      order: { createdAt: 'DESC' },
    });
    if (anyRun) return anyRun;

    throw new NotFoundException('Chưa có phiên chạy MRP nào');
  }

  // ── listRuns ────────────────────────────────────────────────────────────────

  async listRuns(): Promise<RunListItem[]> {
    const runs = await this.runRepo.find({ order: { createdAt: 'DESC' } });
    return runs.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      currentRound: r.currentRound,
    }));
  }

  // ── getPurchaseSummary ──────────────────────────────────────────────────────

  async getPurchaseSummary(runId?: number): Promise<PurchaseSummaryResult> {
    const run = await this.resolveRun(runId);

    const allLines = await this.lineRepo.find({ where: { runId: run.id } });

    // Distinct rounds in this run
    const allRounds = [...new Set(allLines.map((l) => l.round))].sort((a, b) => a - b);

    // Filter to lines with purchase > 0
    const purchaseLines = allLines.filter((l) => l.purchase > 0);

    // Distinct codes that appear with purchase > 0
    const codes = [...new Set(purchaseLines.map((l) => l.componentCode))];
    const codeMap = await this.componentsService.getCodeMap(codes);

    // Pivot: per code, sum per round
    const pivot = new Map<string, Record<number, number>>();
    for (const line of purchaseLines) {
      if (!pivot.has(line.componentCode)) {
        pivot.set(line.componentCode, {});
      }
      const roundMap = pivot.get(line.componentCode)!;
      roundMap[line.round] = (roundMap[line.round] ?? 0) + line.purchase;
    }

    const items: PurchaseItem[] = codes
      .map((code) => {
        const comp = codeMap.get(code);
        const roundMap = pivot.get(code) ?? {};
        const total = Object.values(roundMap).reduce((sum, v) => sum + v, 0);
        return {
          code,
          classification: comp?.classification ?? null,
          description: comp?.description ?? null,
          uom: comp?.uom ?? null,
          total,
          rounds: roundMap,
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code));

    return {
      run: {
        id: run.id,
        status: run.status,
        createdAt: run.createdAt,
        rounds: allRounds,
      },
      items,
    };
  }

  // ── getRecoverySummary ──────────────────────────────────────────────────────

  async getRecoverySummary(runId?: number): Promise<PurchaseSummaryResult> {
    const run = await this.resolveRun(runId);

    const allLines = await this.lineRepo.find({ where: { runId: run.id } });

    // Distinct rounds in this run
    const allRounds = [...new Set(allLines.map((l) => l.round))].sort((a, b) => a - b);

    // Filter to lines with recovery > 0
    const recoveryLines = allLines.filter((l) => l.recovery > 0);

    // Distinct codes that appear with recovery > 0
    const codes = [...new Set(recoveryLines.map((l) => l.componentCode))];
    const codeMap = await this.componentsService.getCodeMap(codes);

    // Pivot: per code, sum per round
    const pivot = new Map<string, Record<number, number>>();
    for (const line of recoveryLines) {
      if (!pivot.has(line.componentCode)) {
        pivot.set(line.componentCode, {});
      }
      const roundMap = pivot.get(line.componentCode)!;
      roundMap[line.round] = (roundMap[line.round] ?? 0) + line.recovery;
    }

    const items: PurchaseItem[] = codes
      .map((code) => {
        const comp = codeMap.get(code);
        const roundMap = pivot.get(code) ?? {};
        const total = Object.values(roundMap).reduce((sum, v) => sum + v, 0);
        return {
          code,
          classification: comp?.classification ?? null,
          description: comp?.description ?? null,
          uom: comp?.uom ?? null,
          total,
          rounds: roundMap,
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code));

    return {
      run: {
        id: run.id,
        status: run.status,
        createdAt: run.createdAt,
        rounds: allRounds,
      },
      items,
    };
  }

  // ── getPsi ──────────────────────────────────────────────────────────────────

  async getPsi(runId?: number): Promise<PsiResult> {
    const run = await this.resolveRun(runId);

    const allLines = await this.lineRepo.find({ where: { runId: run.id } });

    // Distinct rounds in this run
    const allRounds = [...new Set(allLines.map((l) => l.round))].sort((a, b) => a - b);

    // All distinct codes in the run
    const codes = [...new Set(allLines.map((l) => l.componentCode))];

    // Fetch metadata and onhand in parallel
    const [codeMap, onhandMap] = await Promise.all([
      this.componentsService.getCodeMap(codes),
      this.onhandService.getQuantityMap(codes),
    ]);

    // Aggregate purchase per code across all rounds
    const purchaseByCode = new Map<string, number>();
    for (const line of allLines) {
      purchaseByCode.set(
        line.componentCode,
        (purchaseByCode.get(line.componentCode) ?? 0) + line.purchase,
      );
    }

    const items: PsiItem[] = codes
      .map((code) => {
        const comp = codeMap.get(code);
        const onhand = onhandMap.get(code) ?? 0;
        const purchase = purchaseByCode.get(code) ?? 0;
        const closing = comp?.inventoryLevel ?? 0;
        const sale = parseFloat((onhand + purchase - closing).toFixed(4));

        return {
          code,
          classification: comp?.classification ?? null,
          description: comp?.description ?? null,
          uom: comp?.uom ?? null,
          onhand,
          purchase,
          sale,
          closing,
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code));

    return {
      run: {
        id: run.id,
        status: run.status,
        createdAt: run.createdAt,
        rounds: allRounds,
      },
      items,
    };
  }
}
