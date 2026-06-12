// MRP Engine — pure functions, no NestJS decorators, no DB
// Task 14: full implementation

// ── Types ─────────────────────────────────────────────────────────────────────

export type EngineMob = 'KHONG' | 'CO_THE' | 'BAT_BUOC';

export interface EngineComponent {
  code: string;
  mob: EngineMob;
  moq: number;
  inventoryLevel: number;
}

export interface BomEdge {
  parentCode: string;
  childCode: string;
  qtyPerUnit: number;
}

export interface DemandInput {
  code: string;
  orderQty: number;
}

export interface EngineLine {
  code: string;
  orderQty: number;
  onhand: number;
  levels: number;
  demand: number;
  purchase: number;
  manufacturing: number;
  recovery: number;
}

export const MAX_ROUNDS = 9;

// ── Helper ────────────────────────────────────────────────────────────────────

/** Round to 4 decimal places to avoid float drift. */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ── defaultSplit ──────────────────────────────────────────────────────────────

/**
 * Compute default purchase / manufacturing split for a given demand.
 *
 * BAT_BUOC: must buy → purchase = max(demand, moq), manufacturing = 0.
 *           Exception: if demand = 0, purchase = 0 (no forced moq purchase).
 * KHONG:    make only → purchase = 0, manufacturing = demand.
 * CO_THE:   default manufacturing = demand, purchase = 0 (user may edit later).
 */
export function defaultSplit(
  demand: number,
  c: EngineComponent,
): { purchase: number; manufacturing: number } {
  if (demand === 0) {
    return { purchase: 0, manufacturing: 0 };
  }

  switch (c.mob) {
    case 'BAT_BUOC':
      return {
        purchase: round4(Math.max(demand, c.moq)),
        manufacturing: 0,
      };
    case 'KHONG':
      return { purchase: 0, manufacturing: round4(demand) };
    case 'CO_THE':
    default:
      return { purchase: 0, manufacturing: round4(demand) };
  }
}

// ── computeRound ──────────────────────────────────────────────────────────────

/**
 * Compute one MRP round.
 *
 * @param demands         - Array of { code, orderQty } for this round.
 * @param components      - Map of all known components by code.
 * @param initialOnhand   - The initial on-hand quantities (constant across rounds).
 * @param purchasedBefore - Sum of purchase quantities from ALL previous rounds.
 * @param demandedBefore  - Set of codes that had demand > 0 in any previous round.
 */
export function computeRound(
  demands: DemandInput[],
  components: Map<string, EngineComponent>,
  initialOnhand: Map<string, number>,
  purchasedBefore: Map<string, number>,
  demandedBefore: Set<string>,
): EngineLine[] {
  return demands.map((d) => {
    const c = components.get(d.code);
    if (!c) {
      throw new Error(`Mã ${d.code} chưa được khai báo tại Quản lý mã`);
    }

    // onhand(code) = initialOnhand(code) + Σ purchases of code in previous rounds
    const onhand = round4(
      (initialOnhand.get(d.code) ?? 0) + (purchasedBefore.get(d.code) ?? 0),
    );

    // levels(code) = 0 if code had demand > 0 in ANY previous round, else inventoryLevel
    const levels = demandedBefore.has(d.code) ? 0 : c.inventoryLevel;

    // raw = orderQty − onhand + levels
    const raw = round4(d.orderQty - onhand + levels);

    const demand = round4(Math.max(0, raw));
    const recovery = round4(Math.max(0, -raw));

    const { purchase, manufacturing } = defaultSplit(demand, c);

    return {
      code: d.code,
      orderQty: round4(d.orderQty),
      onhand,
      levels,
      demand,
      purchase,
      manufacturing,
      recovery,
    };
  });
}

// ── applyPurchaseEdit ─────────────────────────────────────────────────────────

/**
 * Apply a user purchase edit for CO_THE lines only.
 *
 * Rules:
 *  - KHONG: throws (cannot buy)
 *  - BAT_BUOC: throws (cannot edit manually)
 *  - purchase < 0 or (0 < purchase < moq): throws
 *  - purchase = 0: reset → manufacturing = demand
 *  - purchase ≥ moq: manufacturing = max(0, demand − purchase)
 */
export function applyPurchaseEdit(
  line: EngineLine,
  purchase: number,
  c: EngineComponent,
): EngineLine {
  if (c.mob === 'KHONG') {
    throw new Error('Mã khai báo là sản xuất, không được mua');
  }
  if (c.mob === 'BAT_BUOC') {
    throw new Error('Mã bắt buộc mua, không chỉnh tay');
  }
  // CO_THE only from here
  if (purchase < 0 || (purchase > 0 && purchase < c.moq)) {
    throw new Error(
      `Số lượng mua phải bằng 0 hoặc ≥ MoQ (${c.moq})`,
    );
  }

  const newPurchase = round4(purchase);
  const newManufacturing = round4(Math.max(0, line.demand - newPurchase));

  return { ...line, purchase: newPurchase, manufacturing: newManufacturing };
}

// ── explodeNextDemands ────────────────────────────────────────────────────────

/**
 * Given the lines from a completed round and the BoM edge list,
 * compute the demand inputs for the next round.
 *
 * Only lines with manufacturing > 0 contribute.
 * Child demands from multiple parents are summed.
 *
 * Uses a pre-grouped Map<parentCode, BomEdge[]> for O(n+m) complexity.
 */
export function explodeNextDemands(
  lines: EngineLine[],
  edges: BomEdge[],
): DemandInput[] {
  // Pre-group edges by parentCode — O(m)
  const edgesByParent = new Map<string, BomEdge[]>();
  for (const edge of edges) {
    const list = edgesByParent.get(edge.parentCode);
    if (list) {
      list.push(edge);
    } else {
      edgesByParent.set(edge.parentCode, [edge]);
    }
  }

  // Accumulate child demands — O(n * avg_children)
  const childDemands = new Map<string, number>();

  for (const line of lines) {
    if (line.manufacturing <= 0) continue;

    const parentEdges = edgesByParent.get(line.code);
    if (!parentEdges) continue;

    for (const edge of parentEdges) {
      const contribution = round4(line.manufacturing * edge.qtyPerUnit);
      const existing = childDemands.get(edge.childCode) ?? 0;
      childDemands.set(edge.childCode, round4(existing + contribution));
    }
  }

  // Convert to DemandInput[]
  return Array.from(childDemands.entries()).map(([code, orderQty]) => ({
    code,
    orderQty,
  }));
}

// ── isFinished ────────────────────────────────────────────────────────────────

/**
 * MRP is finished when:
 *  - Every line has manufacturing === 0, OR
 *  - The round number has reached MAX_ROUNDS.
 */
export function isFinished(lines: EngineLine[], round: number): boolean {
  if (round >= MAX_ROUNDS) return true;
  return lines.every((l) => l.manufacturing === 0);
}
