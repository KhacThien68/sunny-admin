import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ComponentEntity, Mob } from '../components/component.entity';
import { AggregationLine, OrderAggregation } from '../orders/aggregation.entity';
import { MrpLine, MrpRun, MrpRunStatus } from './mrp-run.entity';
import { MrpService } from './mrp.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAggregation(lines: { componentCode: string; totalQty: number }[]): OrderAggregation & { lines: AggregationLine[] } {
  const agg = new OrderAggregation();
  agg.id = 1;
  agg.createdById = 1;
  agg.createdAt = new Date();
  agg.lines = lines.map((l, i) => {
    const al = new AggregationLine();
    al.id = i + 1;
    al.aggregationId = 1;
    al.componentCode = l.componentCode;
    al.totalQty = l.totalQty;
    return al;
  });
  return agg as any;
}

function makeComponent(code: string, mob: Mob, moq = 0, inventoryLevel = 0): ComponentEntity {
  const c = new ComponentEntity();
  c.id = 1;
  c.code = code;
  c.mob = mob;
  c.moq = moq;
  c.inventoryLevel = inventoryLevel;
  c.description = `Desc ${code}`;
  c.uom = 'PC';
  c.classification = null;
  return c;
}

function makeLine(overrides: Partial<MrpLine> = {}): MrpLine {
  const l = new MrpLine();
  l.id = overrides.id ?? 1;
  l.runId = overrides.runId ?? 1;
  l.round = overrides.round ?? 1;
  l.componentCode = overrides.componentCode ?? 'CHA';
  l.orderQty = overrides.orderQty ?? 50;
  l.onhand = overrides.onhand ?? 3;
  l.levels = overrides.levels ?? 2;
  l.demand = overrides.demand ?? 49;
  l.purchase = overrides.purchase ?? 0;
  l.manufacturing = overrides.manufacturing ?? 49;
  l.recovery = overrides.recovery ?? 0;
  l.locked = overrides.locked ?? false;
  return l;
}

function makeRun(overrides: Partial<MrpRun> = {}): MrpRun {
  const r = new MrpRun();
  r.id = overrides.id ?? 1;
  r.aggregationId = overrides.aggregationId ?? 1;
  r.status = overrides.status ?? MrpRunStatus.RUNNING;
  r.currentRound = overrides.currentRound ?? 1;
  r.createdById = overrides.createdById ?? 1;
  r.createdAt = overrides.createdAt ?? new Date();
  return r;
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const makeRunRepo = (runs: MrpRun[] = []) => ({
  find: jest.fn().mockResolvedValue(runs),
  findOne: jest.fn().mockResolvedValue(runs[0] ?? null),
  create: jest.fn((dto: Partial<MrpRun>) => Object.assign(new MrpRun(), { id: 1, ...dto })),
  save: jest.fn(async (entity: MrpRun) => entity),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
});

const makeLineRepo = (lines: MrpLine[] = []) => ({
  find: jest.fn().mockResolvedValue(lines),
  findOne: jest.fn().mockResolvedValue(lines[0] ?? null),
  create: jest.fn((dto: Partial<MrpLine>) => Object.assign(new MrpLine(), { id: lines.length + 1, ...dto })),
  save: jest.fn(async (entity: MrpLine) => entity),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
});

function buildService(overrides: {
  runs?: MrpRun[];
  lines?: MrpLine[];
  aggregation?: any;
  codeMap?: Map<string, ComponentEntity>;
  onhandMap?: Map<string, number>;
  edges?: { parentCode: string; childCode: string; qtyPerUnit: number }[];
  findByCode?: (code: string) => ComponentEntity | null;
}): MrpService {
  const runRepo = makeRunRepo(overrides.runs ?? []);
  const lineRepo = makeLineRepo(overrides.lines ?? []);

  const ordersService = {
    getLatestAggregation: jest.fn().mockResolvedValue(
      overrides.aggregation ??
        makeAggregation([{ componentCode: 'CHA', totalQty: 50 }]),
    ),
  };

  const defaultCodeMap = new Map<string, ComponentEntity>([
    ['CHA', makeComponent('CHA', Mob.KHONG, 0, 2)],
  ]);

  const componentsService = {
    getCodeMap: jest.fn().mockResolvedValue(overrides.codeMap ?? defaultCodeMap),
    findByCode: jest.fn().mockImplementation(
      overrides.findByCode ??
        ((code: string) => (overrides.codeMap ?? defaultCodeMap).get(code) ?? null),
    ),
  };

  const onhandService = {
    getQuantityMap: jest
      .fn()
      .mockResolvedValue(overrides.onhandMap ?? new Map([['CHA', 3]])),
  };

  const bomService = {
    getAllEdges: jest.fn().mockResolvedValue(overrides.edges ?? []),
  };

  const usersService = {
    findAll: jest.fn().mockResolvedValue([]),
  };

  const savedLines: MrpLine[] = [];
  const savedRuns: MrpRun[] = [];

  const dataSource = {
    transaction: jest.fn(async (cb: (em: any) => Promise<any>) => {
      const em = {
        getRepository: jest.fn((entity: any) => {
          if (entity === MrpRun || entity?.name === 'MrpRun') {
            return {
              create: (dto: Partial<MrpRun>) => Object.assign(new MrpRun(), { id: savedRuns.length + 1, ...dto }),
              save: jest.fn(async (r: MrpRun) => { savedRuns.push(r); return r; }),
              update: jest.fn().mockResolvedValue({ affected: 1 }),
            };
          }
          if (entity === MrpLine || entity?.name === 'MrpLine') {
            return {
              create: (dto: Partial<MrpLine>) => Object.assign(new MrpLine(), { id: savedLines.length + 1, ...dto }),
              save: jest.fn(async (l: MrpLine) => { savedLines.push(l); return l; }),
              find: jest.fn().mockResolvedValue(overrides.lines ?? []),
              update: jest.fn().mockResolvedValue({ affected: 1 }),
            };
          }
          return {};
        }),
      };
      return cb(em);
    }),
  };

  return new MrpService(
    runRepo as any,
    lineRepo as any,
    ordersService as any,
    componentsService as any,
    onhandService as any,
    bomService as any,
    usersService as any,
    dataSource as any,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MrpService', () => {
  // Test 1: createRun computes round 1 — demand 49 from order 50 onhand 3 level 2
  it('createRun computes round 1: order 50, onhand 3, level 2 → demand 49, manufacturing 49', async () => {
    const service = buildService({
      aggregation: makeAggregation([{ componentCode: 'CHA', totalQty: 50 }]),
      codeMap: new Map([['CHA', makeComponent('CHA', Mob.KHONG, 0, 2)]]),
      onhandMap: new Map([['CHA', 3]]),
      edges: [],
    });

    const result = await service.createRun(1);

    expect(result.run.status).toBe(MrpRunStatus.RUNNING);
    expect(result.run.currentRound).toBe(1);
    expect(result.lines).toHaveLength(1);

    const line = result.lines[0];
    expect(line.componentCode).toBe('CHA');
    expect(line.orderQty).toBe(50);
    expect(line.onhand).toBe(3);
    expect(line.levels).toBe(2);
    expect(line.demand).toBe(49);
    expect(line.manufacturing).toBe(49);
    expect(line.purchase).toBe(0);
  });

  // Test 2: createRun with unregistered code → BadRequest listing it
  it('createRun with unregistered code throws BadRequestException listing missing code', async () => {
    const service = buildService({
      aggregation: makeAggregation([
        { componentCode: 'CHA', totalQty: 50 },
        { componentCode: 'UNKNOWN_CODE', totalQty: 10 },
      ]),
      codeMap: new Map([['CHA', makeComponent('CHA', Mob.KHONG, 0, 2)]]),
      // UNKNOWN_CODE is NOT in codeMap
    });

    await expect(service.createRun(1)).rejects.toThrow(BadRequestException);
    await expect(service.createRun(1)).rejects.toThrow('UNKNOWN_CODE');
  });

  // Test 3: createRun no aggregation → propagates NotFoundException
  it('createRun with no aggregation propagates NotFoundException', async () => {
    const ordersService = {
      getLatestAggregation: jest.fn().mockRejectedValue(new NotFoundException('Chưa có lần tổng hợp nào')),
    };

    const service = new MrpService(
      makeRunRepo() as any,
      makeLineRepo() as any,
      ordersService as any,
      { getCodeMap: jest.fn(), findByCode: jest.fn() } as any,
      { getQuantityMap: jest.fn() } as any,
      { getAllEdges: jest.fn() } as any,
      { findAll: jest.fn() } as any,
      { transaction: jest.fn() } as any,
    );

    await expect(service.createRun(1)).rejects.toThrow(NotFoundException);
  });

  // Test 4: updateLine on locked line → BadRequest
  it('updateLine on locked line → BadRequest', async () => {
    const lockedLine = makeLine({ locked: true, round: 1 });
    const run = makeRun({ currentRound: 1, status: MrpRunStatus.RUNNING });

    const runRepo = makeRunRepo([run]);
    runRepo.findOne = jest.fn().mockResolvedValue(run);
    const lineRepo = makeLineRepo([lockedLine]);
    lineRepo.findOne = jest.fn().mockResolvedValue(lockedLine);

    const service = new MrpService(
      runRepo as any,
      lineRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.updateLine(1, 1, 10)).rejects.toThrow(BadRequestException);
    await expect(service.updateLine(1, 1, 10)).rejects.toThrow('Dòng đã bị khoá');
  });

  // Test 5: updateLine on non-current round → BadRequest
  it('updateLine on non-current round → BadRequest', async () => {
    const line = makeLine({ locked: false, round: 1 });
    const run = makeRun({ currentRound: 2, status: MrpRunStatus.RUNNING });

    const runRepo = makeRunRepo([run]);
    runRepo.findOne = jest.fn().mockResolvedValue(run);
    const lineRepo = makeLineRepo([line]);
    lineRepo.findOne = jest.fn().mockResolvedValue(line);

    const service = new MrpService(
      runRepo as any,
      lineRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.updateLine(1, 1, 10)).rejects.toThrow(BadRequestException);
    await expect(service.updateLine(1, 1, 10)).rejects.toThrow('Chỉ được sửa vòng hiện tại');
  });

  // Test 6: updateLine purchase 10 on CO_THE demand 49 → manufacturing 39
  it('updateLine purchase 10 on CO_THE demand 49 → manufacturing 39', async () => {
    const line = makeLine({
      locked: false,
      round: 1,
      demand: 49,
      purchase: 0,
      manufacturing: 49,
      componentCode: 'CHA',
    });
    const run = makeRun({ currentRound: 1, status: MrpRunStatus.RUNNING });

    const runRepo = makeRunRepo([run]);
    runRepo.findOne = jest.fn().mockResolvedValue(run);

    const updatedLine = { ...line };
    const lineRepo = makeLineRepo([line]);
    lineRepo.findOne = jest.fn().mockResolvedValue(line);
    lineRepo.save = jest.fn().mockImplementation(async (l: MrpLine) => l);

    const componentsService = {
      findByCode: jest.fn().mockResolvedValue(makeComponent('CHA', Mob.CO_THE, 5, 2)),
      getCodeMap: jest.fn(),
    };

    const service = new MrpService(
      runRepo as any,
      lineRepo as any,
      {} as any,
      componentsService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.updateLine(1, 1, 10);
    expect(result.purchase).toBe(10);
    expect(result.manufacturing).toBe(39);
  });

  // Test 7: closeRound explodes BoM into next round
  it('closeRound explodes BoM into round 2 with correct child quantities', async () => {
    // CHA manufacturing 49, BoM CHA→CON qty 2, so CON orderQty = 98
    const chaLine = makeLine({
      componentCode: 'CHA',
      manufacturing: 49,
      demand: 49,
      purchase: 0,
      round: 1,
      locked: false,
    });
    const run = makeRun({ currentRound: 1, status: MrpRunStatus.RUNNING });

    const conComponent = makeComponent('CON', Mob.BAT_BUOC, 5, 0);
    const edges = [{ parentCode: 'CHA', childCode: 'CON', qtyPerUnit: 2 }];

    const savedRound2Lines: MrpLine[] = [];
    let savedRun: MrpRun | null = null;

    const dataSource = {
      transaction: jest.fn(async (cb: (em: any) => Promise<any>) => {
        const em = {
          getRepository: (entity: any) => {
            if (entity === MrpRun) {
              return {
                save: jest.fn(async (r: MrpRun) => { savedRun = r; return r; }),
                update: jest.fn(),
              };
            }
            if (entity === MrpLine) {
              return {
                create: (dto: Partial<MrpLine>) => Object.assign(new MrpLine(), dto),
                save: jest.fn(async (l: MrpLine) => { savedRound2Lines.push(l); return l; }),
                find: jest.fn().mockResolvedValue([chaLine]),  // all locked lines
                update: jest.fn(),
              };
            }
            return {};
          },
        };
        return cb(em);
      }),
    };

    const runRepo = makeRunRepo([run]);
    runRepo.findOne = jest.fn()
      .mockResolvedValueOnce(run)     // first call in closeRound
      .mockResolvedValueOnce(makeRun({ currentRound: 2, status: MrpRunStatus.RUNNING })); // for getRun reload

    const lineRepo = makeLineRepo([chaLine]);
    lineRepo.find = jest.fn()
      .mockResolvedValueOnce([chaLine])           // current round lines
      .mockResolvedValueOnce([chaLine, ...savedRound2Lines]); // getRun reload

    const componentsService = {
      getCodeMap: jest.fn().mockResolvedValue(new Map([['CON', conComponent]])),
      findByCode: jest.fn(),
    };

    const onhandService = {
      getQuantityMap: jest.fn().mockResolvedValue(new Map([['CON', 0]])),
    };

    const bomService = {
      getAllEdges: jest.fn().mockResolvedValue(edges),
    };

    const service = new MrpService(
      runRepo as any,
      lineRepo as any,
      {} as any,
      componentsService as any,
      onhandService as any,
      bomService as any,
      { findAll: jest.fn().mockResolvedValue([]) } as any,
      dataSource as any,
    );

    // Override getRun to avoid full DB reload
    service.getRun = jest.fn().mockResolvedValue({
      run: makeRun({ currentRound: 2 }),
      rounds: [
        { round: 1, locked: true, lines: [chaLine] },
        {
          round: 2, locked: false, lines: [{
            ...new MrpLine(),
            componentCode: 'CON',
            orderQty: 98,
            demand: 98,
            purchase: 98,  // BAT_BUOC moq 5 → purchase = max(98,5) = 98
            manufacturing: 0,
          }],
        },
      ],
    });

    const result = await service.closeRound(1);

    // Verify round 2 would have CON with orderQty 98
    const round2 = result.rounds.find(r => r.round === 2);
    expect(round2).toBeDefined();
    const conLine = round2!.lines.find(l => l.componentCode === 'CON');
    expect(conLine).toBeDefined();
    expect(conLine!.orderQty).toBe(98);
  });

  // Test 8: closeRound when all manufacturing 0 → DONE, no new lines
  it('closeRound when all manufacturing 0 → status DONE', async () => {
    const doneLines = [makeLine({ manufacturing: 0, demand: 0, locked: false, round: 1 })];
    const run = makeRun({ currentRound: 1, status: MrpRunStatus.RUNNING });

    let savedRunStatus: MrpRunStatus | null = null;

    const dataSource = {
      transaction: jest.fn(async (cb: (em: any) => Promise<any>) => {
        const em = {
          getRepository: (entity: any) => {
            if (entity === MrpRun) {
              return {
                save: jest.fn(async (r: MrpRun) => { savedRunStatus = r.status; return r; }),
                update: jest.fn(),
              };
            }
            if (entity === MrpLine) {
              return {
                create: jest.fn(),
                save: jest.fn(),
                find: jest.fn().mockResolvedValue(doneLines),
                update: jest.fn(),
              };
            }
            return {};
          },
        };
        return cb(em);
      }),
    };

    const runRepo = makeRunRepo([run]);
    runRepo.findOne = jest.fn()
      .mockResolvedValueOnce(run)
      .mockResolvedValueOnce(makeRun({ status: MrpRunStatus.DONE }));

    const lineRepo = makeLineRepo(doneLines);
    lineRepo.find = jest.fn().mockResolvedValue(doneLines);

    const bomService = {
      getAllEdges: jest.fn().mockResolvedValue([]),
    };

    const service = new MrpService(
      runRepo as any,
      lineRepo as any,
      {} as any,
      { getCodeMap: jest.fn().mockResolvedValue(new Map()), findByCode: jest.fn() } as any,
      { getQuantityMap: jest.fn().mockResolvedValue(new Map()) } as any,
      bomService as any,
      { findAll: jest.fn().mockResolvedValue([]) } as any,
      dataSource as any,
    );

    service.getRun = jest.fn().mockResolvedValue({
      run: makeRun({ status: MrpRunStatus.DONE }),
      rounds: [{ round: 1, locked: true, lines: doneLines }],
    });

    const result = await service.closeRound(1);
    expect(savedRunStatus).toBe(MrpRunStatus.DONE);
    expect(result.run.status).toBe(MrpRunStatus.DONE);
  });

  // Test 9: closeRound when DONE run → BadRequest
  it('closeRound on DONE run → BadRequest', async () => {
    const run = makeRun({ status: MrpRunStatus.DONE });
    const runRepo = makeRunRepo([run]);
    runRepo.findOne = jest.fn().mockResolvedValue(run);

    const service = new MrpService(
      runRepo as any,
      makeLineRepo() as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.closeRound(1)).rejects.toThrow(BadRequestException);
    await expect(service.closeRound(1)).rejects.toThrow('Phiên đã hoàn tất');
  });
});
