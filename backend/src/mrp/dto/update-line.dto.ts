import { IsNumber, Min } from 'class-validator';

export class UpdateLineDto {
  @IsNumber()
  @Min(0)
  purchase: number;
}
