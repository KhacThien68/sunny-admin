import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { decimalToNumber } from '../common/decimal.transformer';

export enum MrpRunStatus {
  RUNNING = 'RUNNING',
  DONE = 'DONE',
}

@Entity('mrp_runs')
export class MrpRun {
  @PrimaryGeneratedColumn() id: number;

  @Column() aggregationId: number;

  @Column({ type: 'enum', enum: MrpRunStatus, default: MrpRunStatus.RUNNING })
  status: MrpRunStatus;

  @Column({ default: 1 }) currentRound: number;

  @Column() createdById: number;

  @CreateDateColumn() createdAt: Date;
}

@Entity('mrp_lines')
@Index(['runId', 'round'])
export class MrpLine {
  @PrimaryGeneratedColumn() id: number;

  @Column() runId: number;

  @Column() round: number;

  @Column() componentCode: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, transformer: decimalToNumber })
  orderQty: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, transformer: decimalToNumber })
  onhand: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, transformer: decimalToNumber })
  levels: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, transformer: decimalToNumber })
  demand: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, transformer: decimalToNumber })
  purchase: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, transformer: decimalToNumber })
  manufacturing: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, transformer: decimalToNumber })
  recovery: number;

  @Column({ default: false }) locked: boolean;
}
