import { IsNumber, Min } from 'class-validator';

export class UpsertOnhandDto {
  @IsNumber()
  @Min(0)
  quantity: number;
}
