import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { decimalToNumber } from '../common/decimal.transformer';

export enum Mob {
  KHONG = 'KHONG',
  CO_THE = 'CO_THE',
  BAT_BUOC = 'BAT_BUOC',
}

@Entity('components')
export class ComponentEntity {
  @PrimaryGeneratedColumn() id: number;

  @Column({ unique: true }) code: string; // Component

  @Column({ type: 'varchar', nullable: true }) classification: string | null;

  @Column({ type: 'varchar', nullable: true }) description: string | null;

  @Column({ default: 'PC' }) uom: string;

  @Column({ type: 'enum', enum: Mob, default: Mob.KHONG }) mob: Mob;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: decimalToNumber,
  })
  moq: number;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: decimalToNumber,
  })
  inventoryLevel: number; // Tồn định mức

  @CreateDateColumn() createdAt: Date;

  @UpdateDateColumn() updatedAt: Date;
}
