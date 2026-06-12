import { NotFoundException } from '@nestjs/common';
import { ComponentEntity, Mob } from '../components/component.entity';
import { MrpLine, MrpRun, MrpRunStatus } from '../mrp/mrp-run.entity';
import { OutputsService } from './outputs.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRun(overrides: Partial<MrpRun> = {}): MrpRun {
  const r = new MrpRun();
  r.id = overrides.id ?? 1;
  r.aggregationId = overrides.aggregationId ?? 1;
  r.status = overrides.status ?? MrpRunStatus.DONE;
  r.currentRound = overrides.currentRound ?? 2;
  r.createdById = overrides.createdById ?? 1;
  r.createdAt = overrides.createdAt ?? new Date('2024-01-01');
  return r;
}

function makeLine(overrides: Partial<MrpLine> = {}): MrpLine {
  const l = new MrpLine();
  l.id = overrides.id ?? 1;
  l.runId = overrides.runId ?? 1;
  l.round = overrides.round ?? 1;
  l.componentCode = overrides.componentCode ?? 'A001';
  l.orderQty = overrides.orderQty ?? 50;
  l.onhand = overrides.onhand ?? 0;
  l.levels = overrides.levels ?? 0;
  l.demand = overrides.demand ?? 50;
  l.purchase = overrides.purchase ?? 0;
  l.manufacturing = overrides.manufacturing ?? 50;
  l.recovery = overrides.recovery ?? 0;
  l.locked = overrides.locked ?? false;
  return l;
}

function makeComponent(code: string, overrides: Partial<ComponentEntity> = {}): ComponentEntity {
  const c = new ComponentEntity();
  c.id = 1;
  c.code = code;
  c.classification = overrides.classification ?? 'CAT';
  c.description = overrides.description ?? `Desc ${code}`;
  c.uom = overrides.uom ?? 'PC';
  c.mob = overrides.mob ?? Mob.KHONG;
  c.moq = overrides.moq ?? 0;
  c.inventoryLevel = overrides.inventoryLevel ?? 0;
  return c;
}

// ── Mock factories ────────────────────────────────────────────────────────────

function makeRunRepo(runs: MrpRun[] = []) {
  return {
    findOne: jest.fn().mockImplementation(async (options: any) => {
      const where = options?.where ?? {};

      // Match by id
      if (where.id !== undefined) {
        return runs.find((r) => r.id === where.id) ?? null;
      }

      // Match by status, ordered DESC
      if (where.status !== undefined) {
        const matched = runs
          .filter((r) => r.status === where.status)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return matched[0] ?? null;
      }

      // No where filter — latest by createdAt
      const sorted = [...runs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return sorted[0] ?? null;
    }),
    find: jest.fn().mockResolvedValue(runs),
  };
}

function makeLineRepo(lines: MrpLine[] = []) {
  return {
    find: jest.fn().mockResolvedValue(lines),
  };
}

function buildService(overrides: {
  runs?: MrpRun[];
  lines?: MrpLine[];
  codeMap?: Map<string, ComponentEntity>;
  onhandMap?: Map<string, number>;
}): OutputsService {
  const runRepo = makeRunRepo(overrides.runs ?? []);
  const lineRepo = makeLineRepo(overrides.lines ?? []);

  const componentsService = {
    getCodeMap: jest.fn().mockResolvedValue(overrides.codeMap ?? new Map()),
  };

  const onhandService = {
    getQuantityMap: jest.fn().mockResolvedValue(overrides.onhandMap ?? new Map()),
  };

  return new OutputsService(
    runRepo as any,
    lineRepo as any,
    componentsService as any,
    onhandService as any,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OutputsService', () => {
  // Test 1: resolveRun — no runs → NotFoundException
  it('resolveRun with no runs throws NotFoundException', async () => {
    const service = buildService({ runs: [] });
    await expect(service.resolveRun()).rejects.toThrow(NotFoundException);
    await expect(service.resolveRun()).rejects.toThrow('Chưa có phiên chạy MRP nào');
  });

  // Test 2: resolveRun — absent runId → picks latest DONE
  it('resolveRun without runId picks latest DONE run', async () => {
    const doneRun = makeRun({ id: 2, status: MrpRunStatus.DONE, createdAt: new Date('2024-02-01') });
    const runningRun = makeRun({ id: 1, status: MrpRunStatus.RUNNING, createdAt: new Date('2024-01-01') });

    const service = buildService({ runs: [runningRun, doneRun] });
    const resolved = await service.resolveRun();
    expect(resolved.id).toBe(2);
    expect(resolved.status).toBe(MrpRunStatus.DONE);
  });

  // Test 3: resolveRun — explicit runId not found → NotFoundException
  it('resolveRun with explicit runId not found throws NotFoundException', async () => {
    const service = buildService({ runs: [] });
    await expect(service.resolveRun(999)).rejects.toThrow(NotFoundException);
    await expect(service.resolveRun(999)).rejects.toThrow('Không tìm thấy phiên chạy');
  });

  // Test 4: getPurchaseSummary pivots across rounds and multiple components
  it('getPurchaseSummary: pivots purchase correctly across rounds and components', async () => {
    const run = makeRun({ id: 1, status: MrpRunStatus.DONE });
    const lines = [
      makeLine({ runId: 1, round: 1, componentCode: 'A001', purchase: 10, recovery: 0 }),
      makeLine({ runId: 1, round: 2, componentCode: 'A001', purchase: 5, recovery: 0 }),
      makeLine({ runId: 1, round: 1, componentCode: 'B002', purchase: 20, recovery: 0 }),
      // Zero purchase — should NOT appear
      makeLine({ runId: 1, round: 1, componentCode: 'C003', purchase: 0, recovery: 0 }),
    ];
    const codeMap = new Map([
      ['A001', makeComponent('A001', { inventoryLevel: 2 })],
      ['B002', makeComponent('B002', { inventoryLevel: 0 })],
    ]);

    const service = buildService({ runs: [run], lines, codeMap });
    const result = await service.getPurchaseSummary();

    expect(result.run.id).toBe(1);
    expect(result.run.rounds).toEqual([1, 2]);

    // items sorted by code
    expect(result.items).toHaveLength(2);
    expect(result.items[0].code).toBe('A001');
    expect(result.items[0].total).toBe(15);
    expect(result.items[0].rounds[1]).toBe(10);
    expect(result.items[0].rounds[2]).toBe(5);

    expect(result.items[1].code).toBe('B002');
    expect(result.items[1].total).toBe(20);
    expect(result.items[1].rounds[1]).toBe(20);
  });

  // Test 5: getRecoverySummary — only includes recovery > 0
  it('getRecoverySummary: only includes lines with recovery > 0', async () => {
    const run = makeRun({ id: 1 });
    const lines = [
      makeLine({ runId: 1, round: 1, componentCode: 'A001', recovery: 7 }),
      // zero recovery — should NOT appear
      makeLine({ runId: 1, round: 1, componentCode: 'B002', recovery: 0 }),
    ];
    const codeMap = new Map([
      ['A001', makeComponent('A001')],
    ]);

    const service = buildService({ runs: [run], lines, codeMap });
    const result = await service.getRecoverySummary();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].code).toBe('A001');
    expect(result.items[0].total).toBe(7);
    expect(result.items[0].rounds[1]).toBe(7);
  });

  // Test 6: getPsi sale math — onhand 3 + purchase 10 - closing 2 = 11
  it('getPsi: sale = onhand + purchase − closing (3 + 10 − 2 = 11)', async () => {
    const run = makeRun({ id: 1 });
    const lines = [
      makeLine({ runId: 1, round: 1, componentCode: 'A001', purchase: 6 }),
      makeLine({ runId: 1, round: 2, componentCode: 'A001', purchase: 4 }),
    ];
    const codeMap = new Map([
      ['A001', makeComponent('A001', { inventoryLevel: 2 })],
    ]);
    const onhandMap = new Map([['A001', 3]]);

    const service = buildService({ runs: [run], lines, codeMap, onhandMap });
    const result = await service.getPsi();

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.code).toBe('A001');
    expect(item.onhand).toBe(3);
    expect(item.purchase).toBe(10);
    expect(item.closing).toBe(2);
    expect(item.sale).toBe(11);
  });
});
