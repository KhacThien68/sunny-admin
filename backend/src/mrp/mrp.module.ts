import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BomModule } from '../bom/bom.module';
import { ComponentsModule } from '../components/components.module';
import { OnhandModule } from '../onhand/onhand.module';
import { OrdersModule } from '../orders/orders.module';
import { UsersModule } from '../users/users.module';
import { MrpLine, MrpRun } from './mrp-run.entity';
import { MrpController } from './mrp.controller';
import { MrpService } from './mrp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MrpRun, MrpLine]),
    OrdersModule,
    ComponentsModule,
    OnhandModule,
    BomModule,
    UsersModule,
  ],
  controllers: [MrpController],
  providers: [MrpService],
  exports: [MrpService],
})
export class MrpModule {}
