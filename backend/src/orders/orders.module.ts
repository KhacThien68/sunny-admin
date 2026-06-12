import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExcelModule } from '../common/excel/excel.module';
import { ComponentsModule } from '../components/components.module';
import { AggregationLine, OrderAggregation } from './aggregation.entity';
import { Order, OrderLine } from './order.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderLine, OrderAggregation, AggregationLine]),
    ComponentsModule,
    ExcelModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
