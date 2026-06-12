import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { decimalToNumber } from '../common/decimal.transformer';

@Entity('order_aggregations')
export class OrderAggregation {
  @PrimaryGeneratedColumn() id: number;

  @Column() createdById: number;

  @CreateDateColumn() createdAt: Date;

  @OneToMany(() => AggregationLine, (l) => l.aggregation, { cascade: true })
  lines: AggregationLine[];
}

@Entity('aggregation_lines')
export class AggregationLine {
  @PrimaryGeneratedColumn() id: number;

  @Column() aggregationId: number;

  @ManyToOne(() => OrderAggregation, (a) => a.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'aggregationId' })
  aggregation: OrderAggregation;

  @Column() componentCode: string;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 4,
    transformer: decimalToNumber,
  })
  totalQty: number;
}
