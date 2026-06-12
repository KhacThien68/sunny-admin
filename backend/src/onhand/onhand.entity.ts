import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { decimalToNumber } from '../common/decimal.transformer';

@Entity('onhand_inventory')
export class OnhandInventory {
  @PrimaryGeneratedColumn() id: number;

  @Column({ unique: true }) componentCode: string;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: decimalToNumber,
  })
  quantity: number;

  @UpdateDateColumn() updatedAt: Date;
}
