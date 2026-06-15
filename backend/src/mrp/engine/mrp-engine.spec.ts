import {
  computeRound,
  defaultSplit,
  applyPurchaseEdit,
  explodeNextDemands,
  isFinished,
  MAX_ROUNDS,
  EngineComponent,
  BomEdge,
  DemandInput,
  EngineLine,
} from './mrp-engine';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeComponent(
  code: string,
  mob: EngineComponent['mob'],
  moq: number,
  inventoryLevel: number,
): EngineComponent {
  return { code, mob, moq, inventoryLevel };
}

function makeComponentsMap(
  components: EngineComponent[],
): Map<string, EngineComponent> {
  return new Map(components.map((c) => [c.code, c]));
}

function makeLine(overrides: Partial<EngineLine>): EngineLine {
  return {
    code: 'X',
    orderQty: 0,
    onhand: 0,
    levels: 0,
    demand: 0,
    purchase: 0,
    manufacturing: 0,
    recovery: 0,
    ...overrides,
  };
}

// ── computeRound ─────────────────────────────────────────────────────────────

describe('computeRound', () => {
  it('test 1 – Excel example: Order 50, OnHand 3, Levels 2, mob CO_THE → demand 49, mfg 49', () => {
    // raw = 50 − 3 + 2 = 49; demand = max(0,49) = 49; CO_THE → mfg 49, purchase 0
    const components = makeComponentsMap([makeComponent('SP', 'CO_THE', 0, 2)]);
    const initialOnhand = new Map([['SP', 3]]);
    const purchasedBefore = new Map<string, number>();
    const demandedBefore = new Set<string>();
    const demands: DemandInput[] = [{ code: 'SP', orderQty: 50 }];

    const lines = computeRound(
      demands,
      components,
      initialOnhand,
      purchasedBefore,
      demandedBefore,
    );

    expect(lines).toHaveLength(1);
    const line = lines[0];
    expect(line.onhand).toBe(3);
    expect(line.levels).toBe(2);
    expect(line.demand).toBe(49);
    expect(line.recovery).toBe(0);
    expect(line.purchase).toBe(0);
    expect(line.manufacturing).toBe(49);
  });

  it('test 2 – Negative raw: Order 5, OnHand 10, Levels 2 → demand 0, recovery 3', () => {
    // raw = 5 − 10 + 2 = −3; demand = max(0,−3) = 0; recovery = max(0,3) = 3
    const components = makeComponentsMap([makeComponent('SP', 'KHONG', 0, 2)]);
    const initialOnhand = new Map([['SP', 10]]);
    const purchasedBefore = new Map<string, number>();
    const demandedBefore = new Set<string>();
    const demands: DemandInput[] = [{ code: 'SP', orderQty: 5 }];

    const lines = computeRound(
      demands,
      components,
      initialOnhand,
      purchasedBefore,
      demandedBefore,
    );

    expect(lines[0].demand).toBe(0);
    expect(lines[0].recovery).toBe(3);
    expect(lines[0].purchase).toBe(0);
    expect(lines[0].manufacturing).toBe(0);
  });

  it('test 3 – BAT_BUOC with moq: demand 3, moq 5 → purchase 5, manufacturing 0', () => {
    // demand = 3, moq = 5 → purchase = max(3,5) = 5
    const components = makeComponentsMap([
      makeComponent('HAT', 'BAT_BUOC', 5, 0),
    ]);
    const initialOnhand = new Map([['HAT', 0]]);
    const purchasedBefore = new Map<string, number>();
    const demandedBefore = new Set<string>();
    const demands: DemandInput[] = [{ code: 'HAT', orderQty: 3 }];

    const lines = computeRound(
      demands,
      components,
      initialOnhand,
      purchasedBefore,
      demandedBefore,
    );

    expect(lines[0].demand).toBe(3);
    expect(lines[0].purchase).toBe(5);
    expect(lines[0].manufacturing).toBe(0);
  });

  it('test 4 – BAT_BUOC demand 0 → purchase 0 (no forced moq purchase)', () => {
    // demand = 0 → purchase should be 0 even for BAT_BUOC
    const components = makeComponentsMap([
      makeComponent('HAT', 'BAT_BUOC', 5, 0),
    ]);
    const initialOnhand = new Map([['HAT', 10]]);
    const purchasedBefore = new Map<string, number>();
    const demandedBefore = new Set<string>();
    const demands: DemandInput[] = [{ code: 'HAT', orderQty: 5 }];
    // raw = 5 − 10 + 0 = −5 → demand 0

    const lines = computeRound(
      demands,
      components,
      initialOnhand,
      purchasedBefore,
      demandedBefore,
    );

    expect(lines[0].demand).toBe(0);
    expect(lines[0].purchase).toBe(0);
    expect(lines[0].manufacturing).toBe(0);
  });

  it('test 5 – KHONG → purchase 0, manufacturing = demand', () => {
    const components = makeComponentsMap([
      makeComponent('PHOI', 'KHONG', 0, 0),
    ]);
    const initialOnhand = new Map([['PHOI', 0]]);
    const purchasedBefore = new Map<string, number>();
    const demandedBefore = new Set<string>();
    const demands: DemandInput[] = [{ code: 'PHOI', orderQty: 20 }];

    const lines = computeRound(
      demands,
      components,
      initialOnhand,
      purchasedBefore,
      demandedBefore,
    );

    expect(lines[0].demand).toBe(20);
    expect(lines[0].purchase).toBe(0);
    expect(lines[0].manufacturing).toBe(20);
  });

  it('test 6 – Round 2 onhand accumulation: initialOnhand 3 + purchasedBefore 10 → onhand 13', () => {
    const components = makeComponentsMap([
      makeComponent('PHOI', 'CO_THE', 0, 2),
    ]);
    const initialOnhand = new Map([['PHOI', 3]]);
    const purchasedBefore = new Map([['PHOI', 10]]);
    const demandedBefore = new Set<string>();
    const demands: DemandInput[] = [{ code: 'PHOI', orderQty: 20 }];

    const lines = computeRound(
      demands,
      components,
      initialOnhand,
      purchasedBefore,
      demandedBefore,
    );

    // onhand = initialOnhand + purchasedBefore = 3 + 10 = 13
    expect(lines[0].onhand).toBe(13);
  });

  it('test 7 – Round 2 levels zeroing: code in demandedBefore → levels 0 even if inventoryLevel 2', () => {
    const components = makeComponentsMap([
      makeComponent('PHOI', 'CO_THE', 0, 2),
    ]);
    const initialOnhand = new Map([['PHOI', 0]]);
    const purchasedBefore = new Map<string, number>();
    const demandedBefore = new Set(['PHOI']);
    const demands: DemandInput[] = [{ code: 'PHOI', orderQty: 20 }];

    const lines = computeRound(
      demands,
      components,
      initialOnhand,
      purchasedBefore,
      demandedBefore,
    );

    // levels should be 0 because PHOI was already demanded
    expect(lines[0].levels).toBe(0);
  });

  it('test 8 – Unknown code → throws with code in message', () => {
    const components = makeComponentsMap([]); // empty
    const initialOnhand = new Map<string, number>();
    const purchasedBefore = new Map<string, number>();
    const demandedBefore = new Set<string>();
    const demands: DemandInput[] = [{ code: 'UNKNOWN', orderQty: 5 }];

    expect(() =>
      computeRound(
        demands,
        components,
        initialOnhand,
        purchasedBefore,
        demandedBefore,
      ),
    ).toThrow('UNKNOWN');
  });

  it('test 9 – Decimal rounding to 4 places avoids float drift', () => {
    // orderQty = 1.00005, onhand = 0, levels = 0 → raw = 1.00005
    // round4(1.00005) = 1.0001
    const components = makeComponentsMap([makeComponent('X', 'KHONG', 0, 0)]);
    const initialOnhand = new Map([['X', 0]]);
    const purchasedBefore = new Map<string, number>();
    const demandedBefore = new Set<string>();
    const demands: DemandInput[] = [{ code: 'X', orderQty: 1.00005 }];

    const lines = computeRound(
      demands,
      components,
      initialOnhand,
      purchasedBefore,
      demandedBefore,
    );

    // All numbers should be rounded to 4 decimal places
    expect(lines[0].demand).toBe(Math.round(1.00005 * 10000) / 10000);
    expect(
      String(lines[0].demand).split('.')[1]?.length ?? 0,
    ).toBeLessThanOrEqual(4);
  });
});

// ── defaultSplit ─────────────────────────────────────────────────────────────

describe('defaultSplit', () => {
  it('CO_THE: default manufacturing = demand, purchase = 0', () => {
    const c = makeComponent('X', 'CO_THE', 5, 0);
    const { purchase, manufacturing } = defaultSplit(49, c);
    expect(purchase).toBe(0);
    expect(manufacturing).toBe(49);
  });

  it('BAT_BUOC: purchase = max(demand, moq), manufacturing = 0', () => {
    const c = makeComponent('X', 'BAT_BUOC', 5, 0);
    const { purchase, manufacturing } = defaultSplit(3, c);
    expect(purchase).toBe(5);
    expect(manufacturing).toBe(0);
  });

  it('KHONG: purchase = 0, manufacturing = demand', () => {
    const c = makeComponent('X', 'KHONG', 0, 0);
    const { purchase, manufacturing } = defaultSplit(20, c);
    expect(purchase).toBe(0);
    expect(manufacturing).toBe(20);
  });
});

// ── applyPurchaseEdit ─────────────────────────────────────────────────────────

describe('applyPurchaseEdit', () => {
  it('test 10 – Excel example: demand 49, edit purchase 10 (moq 5, CO_THE) → manufacturing 39', () => {
    const c = makeComponent('SP', 'CO_THE', 5, 2);
    const line = makeLine({
      code: 'SP',
      demand: 49,
      purchase: 0,
      manufacturing: 49,
    });
    const updated = applyPurchaseEdit(line, 10, c);
    expect(updated.purchase).toBe(10);
    expect(updated.manufacturing).toBe(39);
  });

  it('test 11 – purchase 0 → manufacturing = demand (reset)', () => {
    const c = makeComponent('SP', 'CO_THE', 5, 2);
    const line = makeLine({
      code: 'SP',
      demand: 49,
      purchase: 10,
      manufacturing: 39,
    });
    const updated = applyPurchaseEdit(line, 0, c);
    expect(updated.purchase).toBe(0);
    expect(updated.manufacturing).toBe(49);
  });

  it('test 12 – 0 < purchase < moq → throws with moq in message', () => {
    const c = makeComponent('SP', 'CO_THE', 5, 2);
    const line = makeLine({
      code: 'SP',
      demand: 49,
      purchase: 0,
      manufacturing: 49,
    });
    expect(() => applyPurchaseEdit(line, 3, c)).toThrow('5');
  });

  it('test 13 – purchase > demand (moq forces overbuy): demand 3, purchase 5 → manufacturing 0 (not negative)', () => {
    const c = makeComponent('SP', 'CO_THE', 5, 2);
    const line = makeLine({
      code: 'SP',
      demand: 3,
      purchase: 0,
      manufacturing: 3,
    });
    const updated = applyPurchaseEdit(line, 5, c);
    expect(updated.purchase).toBe(5);
    expect(updated.manufacturing).toBe(0);
  });

  it('test 14 – mob KHONG, purchase 2 → throws Vietnamese message', () => {
    const c = makeComponent('X', 'KHONG', 0, 0);
    const line = makeLine({
      code: 'X',
      demand: 20,
      purchase: 0,
      manufacturing: 20,
    });
    expect(() => applyPurchaseEdit(line, 2, c)).toThrow(
      'Mã khai báo là sản xuất, không được mua',
    );
  });

  it('test 15 – mob BAT_BUOC → throws Vietnamese message', () => {
    const c = makeComponent('X', 'BAT_BUOC', 5, 0);
    const line = makeLine({
      code: 'X',
      demand: 10,
      purchase: 10,
      manufacturing: 0,
    });
    expect(() => applyPurchaseEdit(line, 20, c)).toThrow(
      'Mã bắt buộc mua, không chỉnh tay',
    );
  });
});

// ── explodeNextDemands ────────────────────────────────────────────────────────

describe('explodeNextDemands', () => {
  it('test 16 – manufacturing 39 × edge 0.029 → child demand 1.131', () => {
    const lines: EngineLine[] = [makeLine({ code: 'SP', manufacturing: 39 })];
    const edges: BomEdge[] = [
      { parentCode: 'SP', childCode: 'CHILD', qtyPerUnit: 0.029 },
    ];
    const demands = explodeNextDemands(lines, edges);
    // 39 * 0.029 = 1.131
    expect(demands).toHaveLength(1);
    expect(demands[0].code).toBe('CHILD');
    expect(demands[0].orderQty).toBe(1.131);
  });

  it('test 17 – Two parents share a child → demands summed', () => {
    const lines: EngineLine[] = [
      makeLine({ code: 'A', manufacturing: 10 }),
      makeLine({ code: 'B', manufacturing: 20 }),
    ];
    const edges: BomEdge[] = [
      { parentCode: 'A', childCode: 'SHARED', qtyPerUnit: 1 },
      { parentCode: 'B', childCode: 'SHARED', qtyPerUnit: 2 },
    ];
    const demands = explodeNextDemands(lines, edges);
    // A contributes 10*1=10, B contributes 20*2=40 → total 50
    expect(demands).toHaveLength(1);
    expect(demands[0].code).toBe('SHARED');
    expect(demands[0].orderQty).toBe(50);
  });

  it('test 18 – manufacturing 0 lines produce nothing; no edges → empty array', () => {
    const lines: EngineLine[] = [makeLine({ code: 'SP', manufacturing: 0 })];
    const edges: BomEdge[] = [
      { parentCode: 'SP', childCode: 'CHILD', qtyPerUnit: 1 },
    ];
    const demands1 = explodeNextDemands(lines, edges);
    expect(demands1).toHaveLength(0);

    const demands2 = explodeNextDemands(lines, []);
    expect(demands2).toHaveLength(0);
  });
});

// ── isFinished ────────────────────────────────────────────────────────────────

describe('isFinished', () => {
  it('test 19 – all manufacturing 0 → true', () => {
    const lines = [
      makeLine({ manufacturing: 0 }),
      makeLine({ manufacturing: 0 }),
    ];
    expect(isFinished(lines, 1)).toBe(true);
  });

  it('test 20 – some manufacturing > 0, round < 9 → false', () => {
    const lines = [
      makeLine({ manufacturing: 5 }),
      makeLine({ manufacturing: 0 }),
    ];
    expect(isFinished(lines, 3)).toBe(false);
  });

  it('test 21 – round = MAX_ROUNDS (9) → true regardless of manufacturing', () => {
    const lines = [makeLine({ manufacturing: 100 })];
    expect(isFinished(lines, MAX_ROUNDS)).toBe(true);
  });
});

// ── Multi-round integration ──────────────────────────────────────────────────

describe('Multi-round integration', () => {
  it('test 22 – 3-level scenario: SP → PHOI → HAT, verifying all intermediate numbers', () => {
    /**
     * Components:
     *   SP   (KHONG,    moq 0,  inventoryLevel 0)
     *   PHOI (CO_THE,   moq 5,  inventoryLevel 2)
     *   HAT  (BAT_BUOC, moq 5,  inventoryLevel 1)
     *
     * BoM edges:
     *   SP   → PHOI  qty 1
     *   PHOI → HAT   qty 0.5
     *
     * Initial onhand:
     *   SP   = 3
     *   PHOI = 0
     *   HAT  = 1
     *
     * Order: SP = 50
     *
     * Round 1:
     *   SP: levels = inventoryLevel = 0 (not in demandedBefore)
     *       onhand = 3 (no purchasedBefore)
     *       raw = 50 − 3 + 0 = 47 → demand 47
     *       KHONG → mfg 47, purchase 0
     *
     * explode round1 → PHOI: 47 * 1 = 47
     *
     * Round 2 (demandedBefore = {SP}, purchasedBefore = {SP:0}):
     *   PHOI: levels = inventoryLevel = 2 (not in demandedBefore)
     *         onhand = 0 + 0 = 0
     *         raw = 47 − 0 + 2 = 49 → demand 49
     *         CO_THE default → mfg 49, purchase 0
     *
     * explode round2 → HAT: 49 * 0.5 = 24.5
     *
     * Round 3 (demandedBefore = {SP, PHOI}, purchasedBefore = {SP:0, PHOI:0}):
     *   HAT: levels = inventoryLevel = 1 (not in demandedBefore)
     *        onhand = 1 + 0 = 1
     *        raw = 24.5 − 1 + 1 = 24.5 → demand 24.5
     *        BAT_BUOC, moq 5 → purchase = max(24.5, 5) = 24.5, mfg 0
     *
     * explode round3 → [] (no HAT children, or mfg=0)
     *
     * Round 4 check: isFinished → true (all mfg 0)
     */

    const components = makeComponentsMap([
      makeComponent('SP', 'KHONG', 0, 0),
      makeComponent('PHOI', 'CO_THE', 5, 2),
      makeComponent('HAT', 'BAT_BUOC', 5, 1),
    ]);

    const edges: BomEdge[] = [
      { parentCode: 'SP', childCode: 'PHOI', qtyPerUnit: 1 },
      { parentCode: 'PHOI', childCode: 'HAT', qtyPerUnit: 0.5 },
    ];

    const initialOnhand = new Map([
      ['SP', 3],
      ['PHOI', 0],
      ['HAT', 1],
    ]);

    // ── Round 1 ──────────────────────────────────────────────────────────────
    let demands: DemandInput[] = [{ code: 'SP', orderQty: 50 }];
    let purchasedBefore = new Map<string, number>();
    let demandedBefore = new Set<string>();

    const round1Lines = computeRound(
      demands,
      components,
      initialOnhand,
      purchasedBefore,
      demandedBefore,
    );

    expect(round1Lines).toHaveLength(1);
    const r1SP = round1Lines[0];
    expect(r1SP.code).toBe('SP');
    expect(r1SP.onhand).toBe(3);
    expect(r1SP.levels).toBe(0);
    expect(r1SP.demand).toBe(47);
    expect(r1SP.purchase).toBe(0);
    expect(r1SP.manufacturing).toBe(47);
    expect(r1SP.recovery).toBe(0);

    // Update tracking after round 1
    for (const line of round1Lines) {
      demandedBefore.add(line.code);
      purchasedBefore.set(
        line.code,
        (purchasedBefore.get(line.code) ?? 0) + line.purchase,
      );
    }

    // ── Explode → Round 2 demands ─────────────────────────────────────────────
    demands = explodeNextDemands(round1Lines, edges);
    expect(demands).toHaveLength(1);
    expect(demands[0].code).toBe('PHOI');
    expect(demands[0].orderQty).toBe(47);

    expect(isFinished(round1Lines, 1)).toBe(false);

    // ── Round 2 ──────────────────────────────────────────────────────────────
    const round2Lines = computeRound(
      demands,
      components,
      initialOnhand,
      purchasedBefore,
      demandedBefore,
    );

    expect(round2Lines).toHaveLength(1);
    const r2PHOI = round2Lines[0];
    expect(r2PHOI.code).toBe('PHOI');
    expect(r2PHOI.onhand).toBe(0); // initialOnhand[PHOI]=0 + purchasedBefore[PHOI]=0
    expect(r2PHOI.levels).toBe(2); // not in demandedBefore yet → inventoryLevel
    expect(r2PHOI.demand).toBe(49); // 47 − 0 + 2 = 49
    expect(r2PHOI.purchase).toBe(0);
    expect(r2PHOI.manufacturing).toBe(49);

    for (const line of round2Lines) {
      demandedBefore.add(line.code);
      purchasedBefore.set(
        line.code,
        (purchasedBefore.get(line.code) ?? 0) + line.purchase,
      );
    }

    // ── Explode → Round 3 demands ─────────────────────────────────────────────
    demands = explodeNextDemands(round2Lines, edges);
    expect(demands).toHaveLength(1);
    expect(demands[0].code).toBe('HAT');
    expect(demands[0].orderQty).toBe(24.5); // 49 * 0.5

    expect(isFinished(round2Lines, 2)).toBe(false);

    // ── Round 3 ──────────────────────────────────────────────────────────────
    const round3Lines = computeRound(
      demands,
      components,
      initialOnhand,
      purchasedBefore,
      demandedBefore,
    );

    expect(round3Lines).toHaveLength(1);
    const r3HAT = round3Lines[0];
    expect(r3HAT.code).toBe('HAT');
    expect(r3HAT.onhand).toBe(1); // initialOnhand[HAT]=1 + purchasedBefore[HAT]=0
    expect(r3HAT.levels).toBe(1); // not in demandedBefore → inventoryLevel
    expect(r3HAT.demand).toBe(24.5); // 24.5 − 1 + 1 = 24.5
    expect(r3HAT.purchase).toBe(24.5); // BAT_BUOC: max(24.5, 5) = 24.5
    expect(r3HAT.manufacturing).toBe(0);

    for (const line of round3Lines) {
      demandedBefore.add(line.code);
      purchasedBefore.set(
        line.code,
        (purchasedBefore.get(line.code) ?? 0) + line.purchase,
      );
    }

    // ── Explode → Round 4 demands (should be empty since mfg = 0) ─────────────
    demands = explodeNextDemands(round3Lines, edges);
    expect(demands).toHaveLength(0);

    expect(isFinished(round3Lines, 3)).toBe(true); // all mfg 0
  });
});
