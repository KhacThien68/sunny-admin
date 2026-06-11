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
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ScreenKey } from '../common/screen-key';
import { CreateComponentDto, UpdateComponentDto } from './dto/component.dto';
import { ComponentsService } from './components.service';

class ComponentQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  classification?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize?: number;
}

@Controller('components')
export class ComponentsController {
  constructor(private readonly componentsService: ComponentsService) {}

  @Get('template')
  @RequirePermission(ScreenKey.COMPONENTS, 'read')
  async getTemplate(@Res() res: Response) {
    const buffer = await this.componentsService.buildImportTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="components-template.xlsx"',
    });
    res.send(buffer);
  }

  @Post('import')
  @RequirePermission(ScreenKey.COMPONENTS, 'create')
  @UseInterceptors(FileInterceptor('file'))
  async importComponents(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('mode') mode: 'preview' | 'commit' = 'preview',
  ) {
    if (!file || !file.originalname.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('Vui lòng chọn file .xlsx');
    }
    return this.componentsService.importFromExcel(file.buffer, mode);
  }

  @Get('classifications')
  @RequirePermission(ScreenKey.COMPONENTS, 'read')
  getClassifications() {
    return this.componentsService.getClassifications();
  }

  @Get()
  @RequirePermission(ScreenKey.COMPONENTS, 'read')
  findAll(@Query() query: ComponentQueryDto) {
    return this.componentsService.findAll(query);
  }

  @Post()
  @RequirePermission(ScreenKey.COMPONENTS, 'create')
  create(@Body() dto: CreateComponentDto) {
    return this.componentsService.create(dto);
  }

  @Patch(':id')
  @RequirePermission(ScreenKey.COMPONENTS, 'update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateComponentDto,
  ) {
    return this.componentsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission(ScreenKey.COMPONENTS, 'delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.componentsService.remove(id);
  }
}
