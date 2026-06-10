import { IsBoolean, IsEnum } from 'class-validator';
import { ScreenKey } from '../../common/screen-key';

export class PermissionEntryDto {
  @IsEnum(ScreenKey)
  screenKey: ScreenKey;

  @IsBoolean()
  canCreate: boolean;

  @IsBoolean()
  canRead: boolean;

  @IsBoolean()
  canUpdate: boolean;

  @IsBoolean()
  canDelete: boolean;
}
