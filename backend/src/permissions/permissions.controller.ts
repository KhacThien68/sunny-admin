import {
  Body,
  Controller,
  Get,
  Param,
  ParseArrayPipe,
  ParseIntPipe,
  Put,
  Request,
} from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ScreenKey } from '../common/screen-key';
import { PermissionEntryDto } from './dto/update-permissions.dto';
import { Permission } from './permission.entity';
import { PermissionsService } from './permissions.service';

interface AuthRequest extends Request {
  user: { sub: number; email: string; isAdmin: boolean };
}

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  /** GET /api/permissions/screens — any authenticated user */
  @Get('screens')
  getScreens() {
    return this.permissionsService.getScreens();
  }

  /** GET /api/permissions/me — returns own permissions (all-true for admin) */
  @Get('me')
  async getMe(@Request() req: AuthRequest) {
    const { sub: userId, isAdmin } = req.user;
    if (isAdmin) {
      return Object.values(ScreenKey).map((key) => {
        const p = new Permission();
        p.userId = userId;
        p.screenKey = key;
        p.canCreate = true;
        p.canRead = true;
        p.canUpdate = true;
        p.canDelete = true;
        return p;
      });
    }
    return this.permissionsService.getForUser(userId);
  }

  /** GET /api/permissions/:userId — requires PERMISSIONS read */
  @Get(':userId')
  @RequirePermission(ScreenKey.PERMISSIONS, 'read')
  getForUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.permissionsService.getForUser(userId);
  }

  /** PUT /api/permissions/:userId — requires PERMISSIONS update */
  @Put(':userId')
  @RequirePermission(ScreenKey.PERMISSIONS, 'update')
  replaceForUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Body(new ParseArrayPipe({ items: PermissionEntryDto, whitelist: true }))
    body: PermissionEntryDto[],
  ) {
    return this.permissionsService.replaceForUser(userId, body);
  }
}
