import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ScreenKey } from '../common/screen-key';
import { UpdateLineDto } from './dto/update-line.dto';
import { MrpService } from './mrp.service';

@Controller('mrp')
export class MrpController {
  constructor(private readonly mrpService: MrpService) {}

  // POST /api/mrp/runs
  @Post('runs')
  @RequirePermission(ScreenKey.MRP, 'create')
  createRun(@CurrentUser() user: { sub: number }) {
    return this.mrpService.createRun(user.sub);
  }

  // GET /api/mrp/runs
  @Get('runs')
  @RequirePermission(ScreenKey.MRP, 'read')
  getRuns() {
    return this.mrpService.getRuns();
  }

  // GET /api/mrp/runs/:id
  @Get('runs/:id')
  @RequirePermission(ScreenKey.MRP, 'read')
  getRun(@Param('id', ParseIntPipe) id: number) {
    return this.mrpService.getRun(id);
  }

  // PATCH /api/mrp/runs/:id/lines/:lineId
  @Patch('runs/:id/lines/:lineId')
  @RequirePermission(ScreenKey.MRP, 'update')
  updateLine(
    @Param('id', ParseIntPipe) runId: number,
    @Param('lineId', ParseIntPipe) lineId: number,
    @Body() dto: UpdateLineDto,
  ) {
    return this.mrpService.updateLine(runId, lineId, dto.purchase);
  }

  // POST /api/mrp/runs/:id/close-round
  @Post('runs/:id/close-round')
  @RequirePermission(ScreenKey.MRP, 'update')
  closeRound(@Param('id', ParseIntPipe) id: number) {
    return this.mrpService.closeRound(id);
  }
}
