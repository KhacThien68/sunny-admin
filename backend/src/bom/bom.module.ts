import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExcelModule } from '../common/excel/excel.module';
import { ComponentsModule } from '../components/components.module';
import { BomLine } from './bom-line.entity';
import { BomController } from './bom.controller';
import { BomService } from './bom.service';

@Module({
  imports: [TypeOrmModule.forFeature([BomLine]), ComponentsModule, ExcelModule],
  controllers: [BomController],
  providers: [BomService],
  exports: [BomService],
})
export class BomModule {}
