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
import * as bcrypt from 'bcrypt';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ScreenKey } from '../common/screen-key';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission(ScreenKey.USERS, 'read')
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @RequirePermission(ScreenKey.USERS, 'create')
  async create(@Body() dto: CreateUserDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email đã tồn tại');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const { password, ...rest } = dto;
    return this.usersService.create({ ...rest, passwordHash });
  }

  @Patch(':id')
  @RequirePermission(ScreenKey.USERS, 'update')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() currentUser: { sub: number; email: string; isAdmin: boolean },
  ) {
    // Self-protection: cannot demote or deactivate yourself
    if (currentUser.sub === id) {
      if (dto.isAdmin === false || dto.isActive === false) {
        throw new BadRequestException(
          'Không thể tự khóa hoặc hạ quyền chính mình',
        );
      }
    }

    if (dto.password) {
      const passwordHash = await bcrypt.hash(dto.password, 10);
      await this.usersService.setPassword(id, passwordHash);
    }

    const { password, ...rest } = dto;
    if (Object.keys(rest).length > 0) {
      return this.usersService.update(id, rest);
    }

    return this.usersService.findById(id);
  }

  @Delete(':id')
  @RequirePermission(ScreenKey.USERS, 'delete')
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
