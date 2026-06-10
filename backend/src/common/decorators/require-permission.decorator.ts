import { SetMetadata } from '@nestjs/common';
import { CrudAction, ScreenKey } from '../screen-key';

export const REQUIRED_PERMISSION_KEY = 'requiredPermission';

export const RequirePermission = (screen: ScreenKey, action: CrudAction) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, { screen, action });
