import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ScreenKey } from '../common/screen-key';
import { BomService } from './bom.service';
import { CreateBomLineDto, UpdateBomLineDto } from './dto/bom-line.dto';

@Controller('bom')
export class BomController {
  constructor(private readonly bomService: BomService) {}

  // ── Static / named routes FIRST (before :id) ────────────────────────────────

  @Get('unregistered')
  @RequirePermission(ScreenKey.BOM, 'read')
  getUnregistered() {
    return this.bomService.getUnregisteredCodes();
  }

  @Get('template')
  @RequirePermission(ScreenKey.BOM, 'read')
  async getTemplate(@Res() res: Response) {
    const buffer = await this.bomService.buildImportTemplate();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="bom-template.xlsx"',
    });
    res.send(buffer);
  }

  @Post('import')
  @RequirePermission(ScreenKey.BOM, 'create')
  @UseInterceptors(FileInterceptor('file'))
  async importBom(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('mode') mode: 'preview' | 'commit' = 'preview',
  ) {
    if (!file || !file.originalname.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('Vui lòng chọn file .xlsx');
    }
    return this.bomService.importFromExcel(file.buffer, mode);
  }

  @Get('tree/:code')
  @RequirePermission(ScreenKey.BOM, 'read')
  getTree(@Param('code') code: string) {
    return this.bomService.getTree(code);
  }

  // ── Collection routes ────────────────────────────────────────────────────────

  @Get()
  @RequirePermission(ScreenKey.BOM, 'read')
  findAll(@Query('parentCode') parentCode?: string) {
    return this.bomService.findAll({ parentCode });
  }

  @Post()
  @RequirePermission(ScreenKey.BOM, 'create')
  create(@Body() dto: CreateBomLineDto) {
    return this.bomService.create(dto);
  }

  // ── ID routes ────────────────────────────────────────────────────────────────

  @Patch(':id')
  @RequirePermission(ScreenKey.BOM, 'update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBomLineDto) {
    return this.bomService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission(ScreenKey.BOM, 'delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.bomService.remove(id);
  }
}
