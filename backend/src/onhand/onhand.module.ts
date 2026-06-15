import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExcelModule } from '../common/excel/excel.module';
import { ComponentsModule } from '../components/components.module';
import { OnhandController } from './onhand.controller';
import { OnhandInventory } from './onhand.entity';
import { OnhandService } from './onhand.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([OnhandInventory]),
    ComponentsModule,
    ExcelModule,
  ],
  controllers: [OnhandController],
  providers: [OnhandService],
  exports: [OnhandService],
})
export class OnhandModule {}
