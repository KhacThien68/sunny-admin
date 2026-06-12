import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ScreenKey } from '../common/screen-key';
import { AddMemberDto, AddScopeDto, CreateTeamDto, UpdateTeamDto } from './dto/team.dto';
import { PurchasingTeamsService } from './purchasing-teams.service';

@Controller('purchasing-teams')
export class PurchasingTeamsController {
  constructor(private readonly purchasingTeamsService: PurchasingTeamsService) {}

  // ── Static / named routes BEFORE :id ─────────────────────────────────────────

  @Get('unassigned-components')
  @RequirePermission(ScreenKey.PURCHASING_TEAMS, 'read')
  getUnassignedComponents() {
    return this.purchasingTeamsService.getUnassignedComponents();
  }

  // ── Collection routes ────────────────────────────────────────────────────────

  @Get()
  @RequirePermission(ScreenKey.PURCHASING_TEAMS, 'read')
  findAll() {
    return this.purchasingTeamsService.findAllTeams();
  }

  @Post()
  @RequirePermission(ScreenKey.PURCHASING_TEAMS, 'create')
  create(@Body() dto: CreateTeamDto) {
    return this.purchasingTeamsService.createTeam(dto);
  }

  // ── Param routes ─────────────────────────────────────────────────────────────

  @Get(':id')
  @RequirePermission(ScreenKey.PURCHASING_TEAMS, 'read')
  getDetail(@Param('id', ParseIntPipe) id: number) {
    return this.purchasingTeamsService.getTeamDetail(id);
  }

  @Patch(':id')
  @RequirePermission(ScreenKey.PURCHASING_TEAMS, 'update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTeamDto) {
    return this.purchasingTeamsService.updateTeam(id, dto);
  }

  @Delete(':id')
  @RequirePermission(ScreenKey.PURCHASING_TEAMS, 'delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.purchasingTeamsService.removeTeam(id);
  }

  // ── Member sub-routes ─────────────────────────────────────────────────────────

  @Post(':id/members')
  @RequirePermission(ScreenKey.PURCHASING_TEAMS, 'update')
  addMember(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddMemberDto,
  ) {
    return this.purchasingTeamsService.addMember(id, dto);
  }

  @Delete(':id/members/:memberId')
  @RequirePermission(ScreenKey.PURCHASING_TEAMS, 'update')
  removeMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('memberId', ParseIntPipe) memberId: number,
  ) {
    return this.purchasingTeamsService.removeMember(id, memberId);
  }

  // ── Scope sub-routes ──────────────────────────────────────────────────────────

  @Post(':id/scopes')
  @RequirePermission(ScreenKey.PURCHASING_TEAMS, 'update')
  addScope(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddScopeDto,
  ) {
    return this.purchasingTeamsService.addScope(id, dto);
  }

  @Delete(':id/scopes/:scopeId')
  @RequirePermission(ScreenKey.PURCHASING_TEAMS, 'update')
  removeScope(
    @Param('id', ParseIntPipe) id: number,
    @Param('scopeId', ParseIntPipe) scopeId: number,
  ) {
    return this.purchasingTeamsService.removeScope(id, scopeId);
  }
}
