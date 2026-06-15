import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn() id: number;
  @Column() userId: number;
  @Index()
  @Column()
  tokenHash: string;
  @Column() expiresAt: Date;
  @Column({ type: 'datetime', nullable: true }) revokedAt: Date | null;
}
