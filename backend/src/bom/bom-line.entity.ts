import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { decimalToNumber } from '../common/decimal.transformer';

@Entity('bom_lines')
@Unique(['parentCode', 'childCode'])
export class BomLine {
  @PrimaryGeneratedColumn() id: number;

  @Column() parentCode: string;

  @Column() childCode: string;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 6,
    transformer: decimalToNumber,
  })
  quantityPerUnit: number;
}
