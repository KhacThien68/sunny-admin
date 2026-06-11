import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class CreateBomLineDto {
  @IsString()
  @IsNotEmpty()
  parentCode: string;

  @IsString()
  @IsNotEmpty()
  childCode: string;

  @IsNumber()
  @IsPositive()
  quantityPerUnit: number;
}

export class UpdateBomLineDto {
  @IsNumber()
  @IsPositive()
  quantityPerUnit: number;
}
