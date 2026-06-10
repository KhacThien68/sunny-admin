import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsService } from '../../permissions/permissions.service';
import { ScreenKey } from '../screen-key';
import { REQUIRED_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PermissionGuard } from './permission.guard';

function makeContext(user: any, handler: object = {}, cls: object = {}): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: jest.Mocked<Reflector>;
  let permissionsService: jest.Mocked<PermissionsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionGuard,
        {
          provide: Reflector,
          useValue: { getAllAndOverride: jest.fn() },
        },
        {
          provide: PermissionsService,
          useValue: { hasPermission: jest.fn() },
        },
      ],
    }).compile();

    guard = module.get<PermissionGuard>(PermissionGuard);
    reflector = module.get(Reflector);
    permissionsService = module.get(PermissionsService);
  });

  it('should allow when no metadata is set on the route', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = makeContext({ sub: 1, isAdmin: false });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(permissionsService.hasPermission).not.toHaveBeenCalled();
  });

  it('should allow admin without hitting DB', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      screen: ScreenKey.PERMISSIONS,
      action: 'read',
    });
    const ctx = makeContext({ sub: 1, isAdmin: true });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(permissionsService.hasPermission).not.toHaveBeenCalled();
  });

  it('should allow when user has the matching permission flag set to true', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      screen: ScreenKey.COMPONENTS,
      action: 'read',
    });
    permissionsService.hasPermission.mockResolvedValue(true);
    const ctx = makeContext({ sub: 2, isAdmin: false });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(permissionsService.hasPermission).toHaveBeenCalledWith(2, ScreenKey.COMPONENTS, 'read');
  });

  it('should throw ForbiddenException when permission flag is false', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      screen: ScreenKey.BOM,
      action: 'delete',
    });
    permissionsService.hasPermission.mockResolvedValue(false);
    const ctx = makeContext({ sub: 3, isAdmin: false });

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      new ForbiddenException('Bạn không có quyền thực hiện thao tác này'),
    );
  });

  it('should throw ForbiddenException when there is no permission row (hasPermission returns false)', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      screen: ScreenKey.ORDERS,
      action: 'create',
    });
    permissionsService.hasPermission.mockResolvedValue(false);
    const ctx = makeContext({ sub: 4, isAdmin: false });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when req.user is undefined', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      screen: ScreenKey.USERS,
      action: 'update',
    });
    const ctx = makeContext(undefined);

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      new ForbiddenException('Bạn không có quyền thực hiện thao tác này'),
    );
    expect(permissionsService.hasPermission).not.toHaveBeenCalled();
  });

  it('uses REQUIRED_PERMISSION_KEY constant when reading metadata', async () => {
    expect(REQUIRED_PERMISSION_KEY).toBe('requiredPermission');
  });
});
