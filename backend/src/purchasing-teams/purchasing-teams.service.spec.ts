import * as ExcelJS from 'exceljs';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ExcelService } from '../common/excel/excel.service';
import { Mob } from '../components/component.entity';
import { PersonnelImportService } from '../users/personnel-import.service';
import { PurchasingTeamsService } from './purchasing-teams.service';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeTeam(id: number, name: string) {
  return { id, name, description: null };
}

function makeUser(id: number, email: string, name = 'Test User') {
  return { id, name, email, team: null, position: null };
}

function makeComponent(
  id: number,
  code: string,
  mob: Mob,
  classification: string | null = null,
) {
  return { id, code, mob, classification, description: null };
}

function makeScope(
  id: number,
  teamId: number,
  opts: { classification?: string | null; componentCode?: string | null } = {},
) {
  return {
    id,
    teamId,
    classification: opts.classification ?? null,
    componentCode: opts.componentCode ?? null,
  };
}

// ── Mock factories ─────────────────────────────────────────────────────────────

const makeRepo = (initial: any[] = []) => ({
  find: jest.fn().mockResolvedValue(initial),
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn((data: any) => ({ ...data })),
  save: jest.fn(async (e: any) => ({ id: Math.random(), ...e })),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
  createQueryBuilder: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
  })),
});

const makeDataSource = () => ({
  transaction: jest.fn(async (cb: (em: any) => Promise<any>) => {
    const em: any = {
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((d: any) => ({ ...d })),
        save: jest.fn(async (e: any) => e),
      }),
    };
    return cb(em);
  }),
});

function makeService(opts: {
  teams?: any[];
  members?: any[];
  scopes?: any[];
  users?: any[];
  components?: any[];
} = {}) {
  const teamRepo = makeRepo(opts.teams ?? []);
  const memberRepo = makeRepo(opts.members ?? []);
  const scopeRepo = makeRepo(opts.scopes ?? []);
  const userRepo = makeRepo(opts.users ?? []);
  const componentRepo = makeRepo(opts.components ?? []);
  const dataSource = makeDataSource();

  const service = new PurchasingTeamsService(
    teamRepo as any,
    memberRepo as any,
    scopeRepo as any,
    userRepo as any,
    componentRepo as any,
    dataSource as any,
  );

  return { service, teamRepo, memberRepo, scopeRepo, userRepo, componentRepo, dataSource };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('PurchasingTeamsService', () => {

  // ── Scope XOR validation ───────────────────────────────────────────────────────

  describe('addScope — XOR validation', () => {
    it('rejects when both classification and componentCode provided', async () => {
      const { service, teamRepo } = makeService();
      teamRepo.findOne.mockResolvedValue(makeTeam(1, 'Team A'));

      await expect(
        service.addScope(1, { classification: 'CAT-A', componentCode: 'COMP-001' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when neither classification nor componentCode provided', async () => {
      const { service, teamRepo } = makeService();
      teamRepo.findOne.mockResolvedValue(makeTeam(1, 'Team A'));

      await expect(service.addScope(1, {})).rejects.toThrow(BadRequestException);
    });

    it('accepts when only classification provided', async () => {
      const { service, teamRepo, scopeRepo } = makeService();
      teamRepo.findOne.mockResolvedValue(makeTeam(1, 'Team A'));
      scopeRepo.findOne.mockResolvedValue(null); // no duplicate

      const result = await service.addScope(1, { classification: 'CAT-A' });
      expect(scopeRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('accepts when only componentCode provided and component exists', async () => {
      const { service, teamRepo, scopeRepo, componentRepo } = makeService();
      teamRepo.findOne.mockResolvedValue(makeTeam(1, 'Team A'));
      componentRepo.findOne.mockResolvedValue(makeComponent(1, 'COMP-001', Mob.BAT_BUOC));
      scopeRepo.findOne.mockResolvedValue(null);

      const result = await service.addScope(1, { componentCode: 'COMP-001' });
      expect(scopeRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  // ── Scope with unknown componentCode ──────────────────────────────────────────

  describe('addScope — componentCode validation', () => {
    it('rejects when componentCode is not in components table', async () => {
      const { service, teamRepo, componentRepo } = makeService();
      teamRepo.findOne.mockResolvedValue(makeTeam(1, 'Team A'));
      componentRepo.findOne.mockResolvedValue(null); // not found

      await expect(
        service.addScope(1, { componentCode: 'UNKNOWN-CODE' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.addScope(1, { componentCode: 'UNKNOWN-CODE' }),
      ).rejects.toThrow('Mã chưa được khai báo tại Quản lý mã');
    });
  });

  // ── Unassigned components logic ────────────────────────────────────────────────

  describe('getUnassignedComponents', () => {
    it('excludes mob KHONG components', async () => {
      const { service, scopeRepo, componentRepo } = makeService();
      scopeRepo.find.mockResolvedValue([]);
      // Only KHONG mob component
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]), // mob != KHONG returns nothing
      };
      componentRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.getUnassignedComponents();
      expect(result).toHaveLength(0);
    });

    it('excludes components covered by classification scope', async () => {
      const { service, scopeRepo, componentRepo } = makeService();
      scopeRepo.find.mockResolvedValue([
        makeScope(1, 1, { classification: 'CAT-A' }),
      ]);
      const purchasableComponent = makeComponent(1, 'COMP-001', Mob.CO_THE, 'CAT-A');
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([purchasableComponent]),
      };
      componentRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.getUnassignedComponents();
      expect(result).toHaveLength(0); // covered by classification scope
    });

    it('excludes components covered by code scope', async () => {
      const { service, scopeRepo, componentRepo } = makeService();
      scopeRepo.find.mockResolvedValue([
        makeScope(1, 1, { componentCode: 'COMP-001' }),
      ]);
      const purchasableComponent = makeComponent(1, 'COMP-001', Mob.BAT_BUOC, null);
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([purchasableComponent]),
      };
      componentRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.getUnassignedComponents();
      expect(result).toHaveLength(0); // covered by code scope
    });

    it('includes purchasable components not covered by any scope', async () => {
      const { service, scopeRepo, componentRepo } = makeService();
      scopeRepo.find.mockResolvedValue([]); // no scopes
      const purchasableComponent = makeComponent(1, 'COMP-001', Mob.BAT_BUOC, 'CAT-B');
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([purchasableComponent]),
      };
      componentRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.getUnassignedComponents();
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('COMP-001');
    });
  });

  // ── addMember duplicate conflict ──────────────────────────────────────────────

  describe('addMember', () => {
    it('throws ConflictException when user is already in the team', async () => {
      const { service, teamRepo, userRepo, memberRepo } = makeService();
      teamRepo.findOne.mockResolvedValue(makeTeam(1, 'Team A'));
      userRepo.findOne.mockResolvedValue(makeUser(1, 'user@test.com'));
      memberRepo.findOne.mockResolvedValue(makeScope(10, 1)); // already exists

      await expect(
        service.addMember(1, { userId: 1 }),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.addMember(1, { userId: 1 }),
      ).rejects.toThrow('Nhân sự đã ở trong team');
    });

    it('throws NotFoundException when user does not exist', async () => {
      const { service, teamRepo, userRepo } = makeService();
      teamRepo.findOne.mockResolvedValue(makeTeam(1, 'Team A'));
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addMember(1, { userId: 999 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── removeTeam cascade ────────────────────────────────────────────────────────

  describe('removeTeam', () => {
    it('cascades delete of members and scopes in a transaction', async () => {
      const { service, teamRepo, dataSource } = makeService();
      teamRepo.findOne.mockResolvedValue(makeTeam(1, 'Team A'));

      await service.removeTeam(1);

      expect(dataSource.transaction).toHaveBeenCalled();
      const emCalls = (dataSource.transaction as jest.Mock).mock.calls;
      expect(emCalls.length).toBeGreaterThan(0);
    });

    it('throws NotFoundException when team does not exist', async () => {
      const { service, teamRepo } = makeService();
      teamRepo.findOne.mockResolvedValue(null);

      await expect(service.removeTeam(999)).rejects.toThrow(NotFoundException);
    });
  });
});

// ── Personnel import tests ─────────────────────────────────────────────────────

async function buildPersonnelBuffer(
  rows: (string | null)[][],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow(['Personal', 'Position', 'Team', 'Mail', 'Phone']);
  for (const row of rows) {
    ws.addRow(row);
  }
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}

const makePersonnelDataSource = () => ({
  transaction: jest.fn(async (cb: (em: any) => Promise<any>) => {
    const em: any = {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((d: any) => ({ ...d })),
        save: jest.fn(async (e: any) => e),
      }),
    };
    return cb(em);
  }),
});

function makePersonnelImportService() {
  const excelService = new ExcelService();
  const dataSource = makePersonnelDataSource();
  return {
    service: new PersonnelImportService(excelService, dataSource as any),
    dataSource,
  };
}

describe('PersonnelImportService', () => {
  describe('importFromExcel', () => {
    it('returns RowError with row number for invalid email (no @)', async () => {
      const { service } = makePersonnelImportService();
      const buf = await buildPersonnelBuffer([
        ['Nguyen Van A', 'Manager', 'Sales', 'notanemail', '0901234567'],
      ]);

      const result = await service.importFromExcel(buf, 'preview');

      expect(result.errors.length).toBeGreaterThan(0);
      const emailError = result.errors.find((e) => e.message === 'Email không hợp lệ');
      expect(emailError).toBeDefined();
      expect(emailError!.row).toBe(2); // row 1 = headers, row 2 = first data row
    });

    it('upserts by email — valid row with @ in email succeeds', async () => {
      const { service, dataSource } = makePersonnelImportService();
      const buf = await buildPersonnelBuffer([
        ['Nguyen Van A', 'Manager', 'Sales', 'user@example.com', '0901234567'],
      ]);

      const result = await service.importFromExcel(buf, 'commit');

      expect(result.errors).toHaveLength(0);
      expect(result.valid).toBe(1);
      expect(result.committed).toBe(true);
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('deduplicates by email — last row wins', async () => {
      const { service } = makePersonnelImportService();
      const buf = await buildPersonnelBuffer([
        ['First Entry', 'Pos1', 'TeamA', 'dup@example.com', null],
        ['Second Entry', 'Pos2', 'TeamB', 'dup@example.com', null],
      ]);

      const result = await service.importFromExcel(buf, 'preview');

      expect(result.valid).toBe(1);
      expect(result.errors).toHaveLength(0);
    });
  });
});
