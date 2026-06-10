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
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ScreenKey } from '../common/screen-key';
import { PersonnelDto, UpdatePersonnelDto } from './dto/personnel.dto';
import { UsersService } from './users.service';

@Controller('personnel')
export class PersonnelController {
  constructor(private readonly usersService: UsersService) {}

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
