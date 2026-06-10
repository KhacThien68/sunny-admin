import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column({ type: 'varchar', nullable: true }) position: string | null; // Chức vụ
  @Column({ type: 'varchar', nullable: true }) team: string | null; // Bộ phận
  @Column({ unique: true }) email: string;
  @Column({ type: 'varchar', nullable: true }) phone: string | null;
  @Column({ type: 'varchar', nullable: true, select: false })
  passwordHash: string | null; // null = nhân sự chưa có tài khoản login
  @Column({ default: false }) isAdmin: boolean;
  @Column({ default: true }) isActive: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
