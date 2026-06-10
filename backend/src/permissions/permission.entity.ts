import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ScreenKey } from '../common/screen-key';

@Entity('permissions')
@Unique(['userId', 'screenKey'])
export class Permission {
  @PrimaryGeneratedColumn() id: number;

  @Column() userId: number;

  @Column({ type: 'enum', enum: ScreenKey }) screenKey: ScreenKey;

  @Column({ default: false }) canCreate: boolean;

  @Column({ default: false }) canRead: boolean;

  @Column({ default: false }) canUpdate: boolean;

  @Column({ default: false }) canDelete: boolean;
}
