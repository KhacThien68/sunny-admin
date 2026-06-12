import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExcelModule } from '../common/excel/excel.module';
import { User } from './user.entity';
import { PersonnelController } from './personnel.controller';
import { PersonnelImportService } from './personnel-import.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), ExcelModule],
  controllers: [UsersController, PersonnelController],
  providers: [UsersService, PersonnelImportService],
  exports: [UsersService],
})
export class UsersModule {}
