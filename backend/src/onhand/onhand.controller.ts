import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ScreenKey } from '../common/screen-key';
import { UpsertOnhandDto } from './dto/onhand.dto';
import { OnhandService } from './onhand.service';

@Controller('onhand')
export class OnhandController {
  constructor(private readonly onhandService: OnhandService) {}

  // ── Static / named routes FIRST (before :componentCode) ─────────────────────

  @Get('template')
  @RequirePermission(ScreenKey.ONHAND, 'read')
  async getTemplate(@Res() res: Response) {
    const buffer = await this.onhandService.buildImportTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="onhand-template.xlsx"',
    });
    res.send(buffer);
  }

  @Post('import')
  @RequirePermission(ScreenKey.ONHAND, 'create')
  @UseInterceptors(FileInterceptor('file'))
  async importOnhand(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('mode') mode: 'preview' | 'commit' = 'preview',
  ) {
    if (!file || !file.originalname.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('Vui lòng chọn file .xlsx');
    }
    return this.onhandService.importFromExcel(file.buffer, mode);
  }

  // ── Collection routes ────────────────────────────────────────────────────────

  @Get()
  @RequirePermission(ScreenKey.ONHAND, 'read')
  findAll() {
    return this.onhandService.findAll();
  }

  // ── Param routes ─────────────────────────────────────────────────────────────

  @Put(':componentCode')
  @RequirePermission(ScreenKey.ONHAND, 'update')
  upsert(
    @Param('componentCode') componentCode: string,
    @Body() dto: UpsertOnhandDto,
  ) {
    return this.onhandService.upsert(componentCode, dto.quantity);
  }

  @Delete(':id')
  @RequirePermission(ScreenKey.ONHAND, 'delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.onhandService.remove(id);
  }
}
