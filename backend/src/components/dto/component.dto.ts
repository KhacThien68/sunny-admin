import { OmitType, PartialType } from '@nestjs/mapped-types';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Mob } from '../component.entity';

export class CreateComponentDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsString()
  classification?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  uom: string;

  @IsEnum(Mob)
  mob: Mob;

  @IsOptional()
  @IsNumber()
  @Min(0)
  moq?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  inventoryLevel?: number;
}

export class UpdateComponentDto extends PartialType(
  OmitType(CreateComponentDto, ['code'] as const),
) {}
