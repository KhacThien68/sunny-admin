import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn() id: number;
  @Column() userId: number;
  @Column() tokenHash: string;
  @Column() expiresAt: Date;
  @Column({ type: 'datetime', nullable: true }) revokedAt: Date | null;
}
