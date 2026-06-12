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

export enum OrderStatus {
  DRAFT = 'DRAFT',
  AGGREGATED = 'AGGREGATED',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn() id: number;

  @Column({ unique: true }) code: string;

  @Column() customerGroup: string;

  @Column({ type: 'varchar', nullable: true }) note: string | null;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.DRAFT })
  status: OrderStatus;

  @Column() createdById: number;

  @CreateDateColumn() createdAt: Date;

  @OneToMany(() => OrderLine, (l) => l.order, { cascade: true })
  lines: OrderLine[];
}

@Entity('order_lines')
export class OrderLine {
  @PrimaryGeneratedColumn() id: number;

  @Column() orderId: number;

  @ManyToOne(() => Order, (o) => o.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column() componentCode: string;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 4,
    transformer: decimalToNumber,
  })
  quantity: number;
}
