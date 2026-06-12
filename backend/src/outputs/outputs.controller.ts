import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ScreenKey } from '../common/screen-key';
import { OutputsService } from './outputs.service';

/** Parse an optional integer query param; returns undefined when absent or blank. */
function parseOptionalInt(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const n = parseInt(value, 10);
  return isNaN(n) ? undefined : n;
}

@Controller('outputs')
export class OutputsController {
  constructor(private readonly outputsService: OutputsService) {}

  // GET /api/outputs/runs — run-selector dropdown; no screen permission needed, any authenticated user
  @Get('runs')
  listRuns() {
    return this.outputsService.listRuns();
  }

  // GET /api/outputs/purchase-summary?runId=
  @Get('purchase-summary')
  @RequirePermission(ScreenKey.OUTPUT_PURCHASE, 'read')
  getPurchaseSummary(@Query('runId') runIdStr?: string) {
    return this.outputsService.getPurchaseSummary(parseOptionalInt(runIdStr));
  }

  // GET /api/outputs/recovery-summary?runId=
  @Get('recovery-summary')
  @RequirePermission(ScreenKey.OUTPUT_PURCHASE, 'read')
  getRecoverySummary(@Query('runId') runIdStr?: string) {
    return this.outputsService.getRecoverySummary(parseOptionalInt(runIdStr));
  }

  // GET /api/outputs/psi?runId=
  @Get('psi')
  @RequirePermission(ScreenKey.OUTPUT_PSI, 'read')
  getPsi(@Query('runId') runIdStr?: string) {
    return this.outputsService.getPsi(parseOptionalInt(runIdStr));
  }
}
