import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';

export class OrderLineDto {
  @IsNotEmpty()
  @IsString()
  componentCode: string;

  @IsNumber()
  @IsPositive()
  quantity: number;
}

export class CreateOrderDto {
  @IsNotEmpty()
  @IsString()
  customerGroup: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  @ArrayMinSize(1)
  lines: OrderLineDto[];
}

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  customerGroup?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  @ArrayMinSize(1)
  lines?: OrderLineDto[];
}
