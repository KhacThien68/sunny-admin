import {
  BadRequestException,
  Body,
  ConflictException,
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ScreenKey } from '../common/screen-key';
import { PersonnelDto, UpdatePersonnelDto } from './dto/personnel.dto';
import { PersonnelImportService } from './personnel-import.service';
import { UsersService } from './users.service';

@Controller('personnel')
export class PersonnelController {
  constructor(
    private readonly usersService: UsersService,
    private readonly personnelImportService: PersonnelImportService,
  ) {}

  // ── Static routes BEFORE :id routes ─────────────────────────────────────────

  @Get('template')
  @RequirePermission(ScreenKey.PERSONNEL, 'read')
  async getTemplate(@Res() res: Response) {
    const buffer = await this.personnelImportService.buildImportTemplate();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="personnel-template.xlsx"',
    });
    res.send(buffer);
  }

  @Post('import')
  @RequirePermission(ScreenKey.PERSONNEL, 'create')
  @UseInterceptors(FileInterceptor('file'))
  async importPersonnel(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('mode') mode: 'preview' | 'commit' = 'preview',
  ) {
    if (!file || !file.originalname.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('Vui lòng chọn file .xlsx');
    }
    return this.personnelImportService.importFromExcel(file.buffer, mode);
  }

  // ── Collection routes ────────────────────────────────────────────────────────

  @Get()
  @RequirePermission(ScreenKey.PERSONNEL, 'read')
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @RequirePermission(ScreenKey.PERSONNEL, 'create')
  async create(@Body() dto: PersonnelDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email đã tồn tại');
    }

    // Create personnel record without password (passwordHash stays null)
    return this.usersService.create({ ...dto });
  }

  // ── Param routes ─────────────────────────────────────────────────────────────

  @Patch(':id')
  @RequirePermission(ScreenKey.PERSONNEL, 'update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePersonnelDto,
  ) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission(ScreenKey.PERSONNEL, 'delete')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: { sub: number; email: string; isAdmin: boolean },
  ) {
    if (currentUser.sub === id) {
      throw new BadRequestException('Không thể tự xóa chính mình');
    }
    await this.usersService.remove(id);
  }
}
