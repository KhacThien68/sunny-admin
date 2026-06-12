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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ScreenKey } from '../common/screen-key';
import { CreateOrderDto, UpdateOrderDto } from './dto/order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ── Static / named routes FIRST (before :id) ────────────────────────────────

  @Get('aggregations')
  @RequirePermission(ScreenKey.ORDERS, 'read')
  getAggregations() {
    return this.ordersService.getAggregations();
  }

  @Get('aggregations/latest')
  @RequirePermission(ScreenKey.ORDERS, 'read')
  getLatestAggregation() {
    return this.ordersService.getLatestAggregation();
  }

  @Get('template')
  @RequirePermission(ScreenKey.ORDERS, 'read')
  async getTemplate(@Res() res: Response) {
    const buffer = await this.ordersService.buildImportTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="orders-template.xlsx"',
    });
    res.send(buffer);
  }

  @Post('import')
  @RequirePermission(ScreenKey.ORDERS, 'create')
  @UseInterceptors(FileInterceptor('file'))
  async importOrders(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('mode') mode: 'preview' | 'commit' = 'preview',
  ) {
    if (!file || !file.originalname.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('Vui lòng chọn file .xlsx');
    }
    return this.ordersService.importFromExcel(file.buffer, mode);
  }

  @Post('aggregate')
  @RequirePermission(ScreenKey.ORDERS, 'create')
  aggregate(@CurrentUser() user: { sub: number; email: string; isAdmin: boolean }) {
    return this.ordersService.aggregate(user.sub);
  }

  // ── Collection routes ────────────────────────────────────────────────────────

  @Get()
  @RequirePermission(ScreenKey.ORDERS, 'read')
  findAll() {
    return this.ordersService.findAll();
  }

  @Post()
  @RequirePermission(ScreenKey.ORDERS, 'create')
  create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: { sub: number; email: string; isAdmin: boolean },
  ) {
    return this.ordersService.create(dto, user.sub);
  }

  // ── ID routes ────────────────────────────────────────────────────────────────

  @Get(':id')
  @RequirePermission(ScreenKey.ORDERS, 'read')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission(ScreenKey.ORDERS, 'update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.ordersService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission(ScreenKey.ORDERS, 'delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.remove(id);
  }
}
