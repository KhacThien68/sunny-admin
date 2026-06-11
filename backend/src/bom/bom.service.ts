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
import { BomLine } from './bom-line.entity';
import { CreateBomLineDto, UpdateBomLineDto } from './dto/bom-line.dto';

export interface BomLineWithFlags extends BomLine {
  parentRegistered: boolean;
  childRegistered: boolean;
  parentDescription: string | null;
  childDescription: string | null;
}

export interface BomTreeNode {
  code: string;
  description: string | null;
  registered: boolean;
  quantityPerUnit: number;
  children: BomTreeNode[];
}

export interface BomImportResult {
  valid: number;
  errors: RowError[];
  warnings: string[];
  committed: boolean;
}

const BOM_SPEC: SheetSpec = {
  columns: [
    { header: 'Material', key: 'parentCode', required: true, type: 'string' },
    { header: 'Material description', key: 'parentDescription', required: false, type: 'string' },
    { header: 'Component', key: 'childCode', required: true, type: 'string' },
    { header: 'Component description', key: 'childDescription', required: false, type: 'string' },
    { header: 'Quantity', key: 'quantityPerUnit', required: true, type: 'number' },
  ],
};

const CYCLE_DEPTH_CAP = 20;

interface ParsedBomRow {
  parentCode: string;
  childCode: string;
  quantityPerUnit: number;
}

@Injectable()
export class BomService {
  constructor(
    @InjectRepository(BomLine)
    private readonly bomRepo: Repository<BomLine>,
    private readonly componentsService: ComponentsService,
    private readonly excelService: ExcelService,
    private readonly dataSource: DataSource,
  ) {}

  // ────────────────────────────────────────────────────────────────────────────
  //  Read
  // ────────────────────────────────────────────────────────────────────────────

  async findAll(query: { parentCode?: string } = {}): Promise<BomLineWithFlags[]> {
    const { parentCode } = query;

    const qb = this.bomRepo
      .createQueryBuilder('b')
      .orderBy('b.parentCode', 'ASC')
      .addOrderBy('b.childCode', 'ASC');

    if (parentCode) {
      qb.where('b.parentCode = :parentCode', { parentCode });
    }

    const lines = await qb.getMany();

    if (lines.length === 0) return [];

    // Bulk-load codes to avoid N+1
    const allCodes = [
      ...new Set([...lines.map((l) => l.parentCode), ...lines.map((l) => l.childCode)]),
    ];
    const codeMap = await this.componentsService.getCodeMap(allCodes);

    return lines.map((line) => ({
      ...line,
      parentRegistered: codeMap.has(line.parentCode),
      childRegistered: codeMap.has(line.childCode),
      parentDescription: codeMap.get(line.parentCode)?.description ?? null,
      childDescription: codeMap.get(line.childCode)?.description ?? null,
    }));
  }

  async findById(id: number): Promise<BomLine | null> {
    return this.bomRepo.findOne({ where: { id } });
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  Create
  // ────────────────────────────────────────────────────────────────────────────

  async create(dto: CreateBomLineDto): Promise<BomLine> {
    if (dto.parentCode === dto.childCode) {
      throw new BadRequestException('Mã cha và mã con không được trùng nhau');
    }

    // Duplicate check
    const existing = await this.bomRepo.findOne({
      where: { parentCode: dto.parentCode, childCode: dto.childCode },
    });
    if (existing) {
      throw new ConflictException('Dòng BoM này đã tồn tại');
    }

    // Cycle check: load all current edges and check if adding parent→child creates a cycle
    const allEdges = await this.bomRepo.find();
    const cyclePath = this.detectCycle(dto.parentCode, dto.childCode, allEdges, CYCLE_DEPTH_CAP);
    if (cyclePath) {
      throw new BadRequestException(`BoM bị lặp vòng: ${cyclePath.join(' → ')}`);
    }

    const line = this.bomRepo.create({
      parentCode: dto.parentCode,
      childCode: dto.childCode,
      quantityPerUnit: dto.quantityPerUnit,
    });
    return this.bomRepo.save(line);
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  Update / Delete
  // ────────────────────────────────────────────────────────────────────────────

  async update(id: number, dto: UpdateBomLineDto): Promise<BomLine> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException('Không tìm thấy dòng BoM');
    }
    existing.quantityPerUnit = dto.quantityPerUnit;
    return this.bomRepo.save(existing);
  }

  async remove(id: number): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException('Không tìm thấy dòng BoM');
    }
    await this.bomRepo.delete(id);
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  Tree
  // ────────────────────────────────────────────────────────────────────────────

  async getTree(rootCode: string, maxDepth = 10): Promise<BomTreeNode> {
    // Load all edges once — avoid N+1
    const allEdges = await this.bomRepo.find();

    // Build adjacency map: parentCode → children edges
    const edgeMap = new Map<string, BomLine[]>();
    for (const edge of allEdges) {
      if (!edgeMap.has(edge.parentCode)) edgeMap.set(edge.parentCode, []);
      edgeMap.get(edge.parentCode)!.push(edge);
    }

    // Collect all codes involved for bulk description lookup
    const allCodes = new Set<string>();
    const collectCodes = (code: string, depth: number) => {
      if (depth > maxDepth) return;
      allCodes.add(code);
      const children = edgeMap.get(code) ?? [];
      for (const child of children) {
        collectCodes(child.childCode, depth + 1);
      }
    };
    collectCodes(rootCode, 0);

    const codeMap = await this.componentsService.getCodeMap([...allCodes]);

    const buildNode = (code: string, qty: number, depth: number): BomTreeNode => {
      const comp = codeMap.get(code);
      const node: BomTreeNode = {
        code,
        description: comp?.description ?? null,
        registered: codeMap.has(code),
        quantityPerUnit: qty,
        children: [],
      };

      if (depth < maxDepth) {
        const children = edgeMap.get(code) ?? [];
        node.children = children.map((edge) =>
          buildNode(edge.childCode, edge.quantityPerUnit, depth + 1),
        );
      }

      return node;
    };

    return buildNode(rootCode, 1, 0);
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  Unregistered codes
  // ────────────────────────────────────────────────────────────────────────────

  async getUnregisteredCodes(): Promise<string[]> {
    const allLines = await this.bomRepo.find();
    if (allLines.length === 0) return [];

    const allCodes = [
      ...new Set([
        ...allLines.map((l) => l.parentCode),
        ...allLines.map((l) => l.childCode),
      ]),
    ];
    const codeMap = await this.componentsService.getCodeMap(allCodes);

    return allCodes.filter((code) => !codeMap.has(code)).sort();
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  Import
  // ────────────────────────────────────────────────────────────────────────────

  async buildImportTemplate(): Promise<Buffer> {
    return this.excelService.buildTemplate(BOM_SPEC);
  }

  async importFromExcel(
    buffer: Buffer,
    mode: 'preview' | 'commit',
  ): Promise<BomImportResult> {
    const parsed = await this.excelService.parse<Record<string, unknown>>(buffer, BOM_SPEC);

    // Start with errors from the generic parser (missing fields, type errors)
    const allErrors: RowError[] = [...parsed.errors];
    const warnings: string[] = [];

    // Domain-level validation on successfully-parsed rows
    const domainValidRows: ParsedBomRow[] = [];

    for (const row of parsed.rows) {
      const parentCode = row['parentCode'] as string;
      const childCode = row['childCode'] as string;
      const qty = row['quantityPerUnit'] as number;

      if (parentCode === childCode) {
        allErrors.push({
          row: 0, // row number not tracked by ExcelService for valid rows
          column: 'Component',
          message: 'Mã cha và mã con không được trùng nhau',
        });
        continue;
      }

      if (qty <= 0) {
        allErrors.push({
          row: 0,
          column: 'Quantity',
          message: 'Số lượng phải lớn hơn 0',
        });
        continue;
      }

      domainValidRows.push({ parentCode, childCode, quantityPerUnit: qty });
    }

    // Deduplicate within file: last (parentCode, childCode) pair wins
    const deduped = new Map<string, ParsedBomRow>();
    for (const row of domainValidRows) {
      deduped.set(`${row.parentCode}::${row.childCode}`, row);
    }
    const dedupedRows = Array.from(deduped.values());

    // Collect unregistered codes as warnings (non-blocking)
    const allCodesInFile = new Set([
      ...dedupedRows.map((r) => r.parentCode),
      ...dedupedRows.map((r) => r.childCode),
    ]);
    if (allCodesInFile.size > 0) {
      const codeMap = await this.componentsService.getCodeMap([...allCodesInFile]);
      for (const code of allCodesInFile) {
        if (!codeMap.has(code)) {
          warnings.push(`Mã ${code} chưa được khai báo tại Quản lý mã`);
        }
      }
    }

    // Cycle check against combined existing + file edges
    const existingEdges = await this.bomRepo.find();
    const combinedEdges: Array<{ parentCode: string; childCode: string }> = [...existingEdges];
    const cleanRows: ParsedBomRow[] = [];

    for (const row of dedupedRows) {
      const cyclePath = this.detectCycle(row.parentCode, row.childCode, combinedEdges, CYCLE_DEPTH_CAP);
      if (cyclePath) {
        allErrors.push({
          row: 0,
          column: 'Component',
          message: `BoM bị lặp vòng: ${cyclePath.join(' → ')}`,
        });
      } else {
        // Add this edge to the running set so subsequent rows in the same file see it
        combinedEdges.push({ parentCode: row.parentCode, childCode: row.childCode });
        cleanRows.push(row);
      }
    }

    if (mode === 'commit' && cleanRows.length > 0) {
      await this.dataSource.transaction(async (em: EntityManager) => {
        const repo = em.getRepository(BomLine);
        for (const row of cleanRows) {
          const existing = await repo.findOne({
            where: { parentCode: row.parentCode, childCode: row.childCode },
          });
          if (existing) {
            existing.quantityPerUnit = row.quantityPerUnit;
            await repo.save(existing);
          } else {
            const line = repo.create(row);
            await repo.save(line);
          }
        }
      });
    }

    return {
      valid: cleanRows.length,
      errors: allErrors,
      warnings,
      committed: mode === 'commit',
    };
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  Cycle detection (DFS)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Check if adding the edge parentCode → childCode would create a cycle.
   * DFS from childCode following existing edges; if parentCode is reachable → cycle.
   * Returns the cycle path (starting with parentCode) if found, null otherwise.
   * `existingEdges` must NOT include the new edge yet.
   */
  detectCycle(
    parentCode: string,
    childCode: string,
    existingEdges: Array<{ parentCode: string; childCode: string }>,
    depthCap: number,
  ): string[] | null {
    // Build adjacency: parent → [children]
    const adj = new Map<string, string[]>();
    for (const edge of existingEdges) {
      if (!adj.has(edge.parentCode)) adj.set(edge.parentCode, []);
      adj.get(edge.parentCode)!.push(edge.childCode);
    }

    // DFS from childCode; detect if parentCode is reachable
    const visited = new Set<string>();
    const path: string[] = [parentCode, childCode];

    const dfs = (current: string, depth: number): boolean => {
      if (depth >= depthCap) return false;
      if (current === parentCode) return true; // cycle found

      if (visited.has(current)) return false;
      visited.add(current);

      const neighbors = adj.get(current) ?? [];
      for (const neighbor of neighbors) {
        path.push(neighbor);
        if (dfs(neighbor, depth + 1)) return true;
        path.pop();
      }
      return false;
    };

    if (dfs(childCode, 0)) {
      return path;
    }
    return null;
  }
}
