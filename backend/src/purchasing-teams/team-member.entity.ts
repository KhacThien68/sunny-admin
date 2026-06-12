import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('purchasing_team_members')
@Unique(['teamId', 'userId'])
export class PurchasingTeamMember {
  @PrimaryGeneratedColumn() id: number;

  @Column() teamId: number;

  @Column() userId: number;
}
