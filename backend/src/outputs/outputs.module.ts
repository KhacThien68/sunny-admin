import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComponentsModule } from '../components/components.module';
import { MrpLine, MrpRun } from '../mrp/mrp-run.entity';
import { OnhandModule } from '../onhand/onhand.module';
import { OutputsController } from './outputs.controller';
import { OutputsService } from './outputs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MrpRun, MrpLine]),
    ComponentsModule,
    OnhandModule,
  ],
  controllers: [OutputsController],
  providers: [OutputsService],
})
export class OutputsModule {}
