import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { CrudAction, ScreenKey } from '../screen-key';
import { PermissionsService } from '../../permissions/permissions.service';

interface RequiredPermission {
  screen: ScreenKey;
  action: CrudAction;
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<
      RequiredPermission | undefined
    >(REQUIRED_PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    // No permission annotation — allow
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user: { sub: number; isAdmin: boolean } | undefined = request.user;

    if (!user) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }

    // Admins bypass permission checks
    if (user.isAdmin) return true;

    const allowed = await this.permissionsService.hasPermission(
      user.sub,
      required.screen,
      required.action,
    );

    if (!allowed) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }

    return true;
  }
}
