import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('purchasing_team_scopes')
export class PurchasingTeamScope {
  @PrimaryGeneratedColumn() id: number;

  @Column() teamId: number;

  @Column({ type: 'varchar', nullable: true }) classification: string | null;

  @Column({ type: 'varchar', nullable: true }) componentCode: string | null;
}
