import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('purchasing_teams')
export class PurchasingTeam {
  @PrimaryGeneratedColumn() id: number;

  @Column({ unique: true }) name: string;

  @Column({ type: 'varchar', nullable: true }) description: string | null;
}
