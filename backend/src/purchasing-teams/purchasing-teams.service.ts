import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Not, Repository } from 'typeorm';
import { ComponentEntity, Mob } from '../components/component.entity';
import { User } from '../users/user.entity';
import {
  AddMemberDto,
  AddScopeDto,
  CreateTeamDto,
  UpdateTeamDto,
} from './dto/team.dto';
import { PurchasingTeamMember } from './team-member.entity';
import { PurchasingTeamScope } from './team-scope.entity';
import { PurchasingTeam } from './team.entity';

export interface TeamListItem {
  id: number;
  name: string;
  description: string | null;
  memberCount: number;
  scopeCount: number;
}

export interface TeamMemberDetail {
  memberId: number;
  userId: number;
  name: string;
  email: string;
  team: string | null;
}

export interface TeamScopeDetail {
  scopeId: number;
  type: 'classification' | 'component';
  value: string;
  componentDescription?: string | null;
}

export interface TeamDetail {
  id: number;
  name: string;
  description: string | null;
  members: TeamMemberDetail[];
  scopes: TeamScopeDetail[];
}

@Injectable()
export class PurchasingTeamsService {
  constructor(
    @InjectRepository(PurchasingTeam)
    private readonly teamRepo: Repository<PurchasingTeam>,
    @InjectRepository(PurchasingTeamMember)
    private readonly memberRepo: Repository<PurchasingTeamMember>,
    @InjectRepository(PurchasingTeamScope)
    private readonly scopeRepo: Repository<PurchasingTeamScope>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ComponentEntity)
    private readonly componentRepo: Repository<ComponentEntity>,
    private readonly dataSource: DataSource,
  ) {}

  // ── List ──────────────────────────────────────────────────────────────────────

  async findAllTeams(): Promise<TeamListItem[]> {
    const teams = await this.teamRepo.find({ order: { id: 'ASC' } });
    if (teams.length === 0) return [];

    const teamIds = teams.map((t) => t.id);

    // Count members per team (single query)
    const memberCounts: { teamId: number; count: string }[] =
      await this.memberRepo
        .createQueryBuilder('m')
        .select('m.teamId', 'teamId')
        .addSelect('COUNT(m.id)', 'count')
        .where('m.teamId IN (:...teamIds)', { teamIds })
        .groupBy('m.teamId')
        .getRawMany();

    // Count scopes per team (single query)
    const scopeCounts: { teamId: number; count: string }[] =
      await this.scopeRepo
        .createQueryBuilder('s')
        .select('s.teamId', 'teamId')
        .addSelect('COUNT(s.id)', 'count')
        .where('s.teamId IN (:...teamIds)', { teamIds })
        .groupBy('s.teamId')
        .getRawMany();

    const memberMap = new Map(
      memberCounts.map((r) => [r.teamId, parseInt(r.count, 10)]),
    );
    const scopeMap = new Map(
      scopeCounts.map((r) => [r.teamId, parseInt(r.count, 10)]),
    );

    return teams.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      memberCount: memberMap.get(t.id) ?? 0,
      scopeCount: scopeMap.get(t.id) ?? 0,
    }));
  }

  // ── Detail ────────────────────────────────────────────────────────────────────

  async getTeamDetail(id: number): Promise<TeamDetail> {
    const team = await this.teamRepo.findOne({ where: { id } });
    if (!team) {
      throw new NotFoundException('Không tìm thấy team');
    }

    // Members with user join
    const memberRows = await this.memberRepo
      .createQueryBuilder('m')
      .innerJoin(User, 'u', 'u.id = m.userId')
      .select([
        'm.id AS memberId',
        'm.userId AS userId',
        'u.name AS name',
        'u.email AS email',
        'u.team AS team',
      ])
      .where('m.teamId = :id', { id })
      .getRawMany<{
        memberId: number;
        userId: number;
        name: string;
        email: string;
        team: string | null;
      }>();

    // Scopes
    const scopeRows = await this.scopeRepo.find({ where: { teamId: id } });

    // Collect component codes to look up descriptions
    const componentCodes = scopeRows
      .filter((s) => s.componentCode != null)
      .map((s) => s.componentCode as string);

    let descMap = new Map<string, string | null>();
    if (componentCodes.length > 0) {
      const components = await this.componentRepo
        .createQueryBuilder('c')
        .where('c.code IN (:...codes)', { codes: componentCodes })
        .getMany();
      descMap = new Map(components.map((c) => [c.code, c.description]));
    }

    const scopes: TeamScopeDetail[] = scopeRows.map((s) => {
      if (s.classification != null) {
        return {
          scopeId: s.id,
          type: 'classification' as const,
          value: s.classification,
        };
      } else {
        return {
          scopeId: s.id,
          type: 'component' as const,
          value: s.componentCode as string,
          componentDescription: descMap.get(s.componentCode as string) ?? null,
        };
      }
    });

    return {
      id: team.id,
      name: team.name,
      description: team.description,
      members: memberRows.map((r) => ({
        memberId: Number(r.memberId),
        userId: Number(r.userId),
        name: r.name,
        email: r.email,
        team: r.team,
      })),
      scopes,
    };
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────────

  async createTeam(dto: CreateTeamDto): Promise<PurchasingTeam> {
    const existing = await this.teamRepo.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException('Tên team đã tồn tại');
    }
    const team = this.teamRepo.create({
      name: dto.name,
      description: dto.description ?? null,
    });
    return this.teamRepo.save(team);
  }

  async updateTeam(id: number, dto: UpdateTeamDto): Promise<PurchasingTeam> {
    const team = await this.teamRepo.findOne({ where: { id } });
    if (!team) {
      throw new NotFoundException('Không tìm thấy team');
    }
    if (dto.name && dto.name !== team.name) {
      const existing = await this.teamRepo.findOne({
        where: { name: dto.name },
      });
      if (existing) {
        throw new ConflictException('Tên team đã tồn tại');
      }
    }
    Object.assign(team, dto);
    return this.teamRepo.save(team);
  }

  async removeTeam(id: number): Promise<void> {
    const team = await this.teamRepo.findOne({ where: { id } });
    if (!team) {
      throw new NotFoundException('Không tìm thấy team');
    }
    await this.dataSource.transaction(async (em: EntityManager) => {
      await em.delete(PurchasingTeamMember, { teamId: id });
      await em.delete(PurchasingTeamScope, { teamId: id });
      await em.delete(PurchasingTeam, { id });
    });
  }

  // ── Members ───────────────────────────────────────────────────────────────────

  async addMember(
    teamId: number,
    dto: AddMemberDto,
  ): Promise<PurchasingTeamMember> {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Không tìm thấy team');
    }

    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const existing = await this.memberRepo.findOne({
      where: { teamId, userId: dto.userId },
    });
    if (existing) {
      throw new ConflictException('Nhân sự đã ở trong team');
    }

    const member = this.memberRepo.create({ teamId, userId: dto.userId });
    return this.memberRepo.save(member);
  }

  async removeMember(teamId: number, memberId: number): Promise<void> {
    const member = await this.memberRepo.findOne({
      where: { id: memberId, teamId },
    });
    if (!member) {
      throw new NotFoundException('Không tìm thấy thành viên');
    }
    await this.memberRepo.delete(memberId);
  }

  // ── Scopes ────────────────────────────────────────────────────────────────────

  async addScope(
    teamId: number,
    dto: AddScopeDto,
  ): Promise<PurchasingTeamScope> {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Không tìm thấy team');
    }

    const hasClassification =
      dto.classification != null && dto.classification.trim() !== '';
    const hasComponentCode =
      dto.componentCode != null && dto.componentCode.trim() !== '';

    // XOR: exactly one must be provided
    if (hasClassification === hasComponentCode) {
      throw new BadRequestException(
        'Phải chọn nhóm hàng hoặc mã cụ thể (chỉ một trong hai)',
      );
    }

    if (hasComponentCode) {
      const component = await this.componentRepo.findOne({
        where: { code: dto.componentCode!.trim() },
      });
      if (!component) {
        throw new BadRequestException('Mã chưa được khai báo tại Quản lý mã');
      }
    }

    // Check for duplicate scope
    const classValue = hasClassification ? dto.classification!.trim() : null;
    const codeValue = hasComponentCode ? dto.componentCode!.trim() : null;

    const duplicate = await this.scopeRepo.findOne({
      where: {
        teamId,
        classification: classValue ?? IsNull(),
        componentCode: codeValue ?? IsNull(),
      },
    });
    if (duplicate) {
      throw new ConflictException('Phạm vi này đã tồn tại');
    }

    const scope = this.scopeRepo.create({
      teamId,
      classification: classValue,
      componentCode: codeValue,
    });
    return this.scopeRepo.save(scope);
  }

  async removeScope(teamId: number, scopeId: number): Promise<void> {
    const scope = await this.scopeRepo.findOne({
      where: { id: scopeId, teamId },
    });
    if (!scope) {
      throw new NotFoundException('Không tìm thấy phạm vi');
    }
    await this.scopeRepo.delete(scopeId);
  }

  // ── Unassigned components ─────────────────────────────────────────────────────

  async getUnassignedComponents(): Promise<ComponentEntity[]> {
    // Get all scope classifications and componentCodes
    const allScopes = await this.scopeRepo.find();

    const coveredClassifications = new Set<string>(
      allScopes
        .filter((s) => s.classification != null)
        .map((s) => s.classification as string),
    );
    const coveredCodes = new Set<string>(
      allScopes
        .filter((s) => s.componentCode != null)
        .map((s) => s.componentCode as string),
    );

    // Query components where mob != KHONG
    const qb = this.componentRepo
      .createQueryBuilder('c')
      .where('c.mob != :khong', { khong: Mob.KHONG });

    const purchasableComponents = await qb.getMany();

    // Filter out those covered by any scope
    return purchasableComponents.filter((c) => {
      // Covered by classification scope
      if (
        c.classification != null &&
        coveredClassifications.has(c.classification)
      ) {
        return false;
      }
      // Covered by code scope
      if (coveredCodes.has(c.code)) {
        return false;
      }
      return true;
    });
  }
}
