import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { RefreshToken } from './refresh-token.entity';

const ERROR_MSG = 'Sai tài khoản hoặc mật khẩu';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let tokenRepo: any;

  const activeUser = {
    id: 1,
    name: 'Admin',
    email: 'admin@sunny.local',
    isAdmin: true,
    isActive: true,
    passwordHash: 'hashed_password',
  };

  const inactiveUser = { ...activeUser, isActive: false };
  const noPasswordUser = { ...activeUser, passwordHash: null };

  beforeEach(async () => {
    tokenRepo = {
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmailWithPassword: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('signed_access_token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_ACCESS_SECRET') return 'test_secret';
              if (key === 'JWT_ACCESS_TTL') return '900s';
              return undefined;
            }),
          },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: tokenRepo,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  describe('login', () => {
    it('should return accessToken, refreshToken and user (without passwordHash) on correct credentials', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(activeUser as any);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      tokenRepo.save.mockResolvedValue({});

      const result = await service.login('admin@sunny.local', 'admin123');

      expect(result).toHaveProperty('accessToken', 'signed_access_token');
      expect(result).toHaveProperty('refreshToken');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBeGreaterThan(0);
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).toMatchObject({
        id: 1,
        name: 'Admin',
        email: 'admin@sunny.local',
        isAdmin: true,
      });
    });

    it('should throw UnauthorizedException with correct message on wrong password', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(activeUser as any);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(service.login('admin@sunny.local', 'wrong')).rejects.toThrow(
        new UnauthorizedException(ERROR_MSG),
      );
    });

    it('should throw UnauthorizedException with correct message for inactive user', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(inactiveUser as any);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      await expect(service.login('admin@sunny.local', 'admin123')).rejects.toThrow(
        new UnauthorizedException(ERROR_MSG),
      );
    });

    it('should throw UnauthorizedException with correct message when passwordHash is null', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(noPasswordUser as any);

      await expect(service.login('admin@sunny.local', 'admin123')).rejects.toThrow(
        new UnauthorizedException(ERROR_MSG),
      );
    });

    it('should throw UnauthorizedException with correct message when user not found', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);

      await expect(service.login('unknown@example.com', 'pass')).rejects.toThrow(
        new UnauthorizedException(ERROR_MSG),
      );
    });
  });

  describe('refresh', () => {
    const rawToken = 'raw_refresh_token_value';
    const storedToken: Partial<RefreshToken> = {
      id: 10,
      userId: 1,
      tokenHash: 'some_hash',
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    };

    it('should throw UnauthorizedException for unknown token', async () => {
      tokenRepo.findOne.mockResolvedValue(null);

      await expect(service.refresh(rawToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for revoked token', async () => {
      tokenRepo.findOne.mockResolvedValue(null);

      await expect(service.refresh(rawToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for expired token', async () => {
      tokenRepo.findOne.mockResolvedValue(null);

      await expect(service.refresh(rawToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user became inactive', async () => {
      tokenRepo.findOne.mockResolvedValue(storedToken);
      usersService.findById.mockResolvedValue(inactiveUser as any);

      await expect(service.refresh(rawToken)).rejects.toThrow(UnauthorizedException);
    });

    it('should rotate token: revoke old, save new, return new accessToken and refreshToken', async () => {
      tokenRepo.findOne.mockResolvedValue(storedToken);
      usersService.findById.mockResolvedValue(activeUser as any);
      tokenRepo.update.mockResolvedValue({});
      tokenRepo.save.mockResolvedValue({});

      const result = await service.refresh(rawToken);

      expect(tokenRepo.update).toHaveBeenCalledWith(storedToken.id, {
        revokedAt: expect.any(Date),
      });
      expect(tokenRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('accessToken', 'signed_access_token');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).toMatchObject({ id: 1 });
    });
  });

  describe('logout', () => {
    const rawToken = 'raw_logout_token';

    it('should set revokedAt on the matching token', async () => {
      const storedToken = { id: 5, userId: 1, revokedAt: null };
      tokenRepo.findOne.mockResolvedValue(storedToken);
      tokenRepo.update.mockResolvedValue({});

      await service.logout(rawToken);

      expect(tokenRepo.update).toHaveBeenCalledWith(storedToken.id, {
        revokedAt: expect.any(Date),
      });
    });

    it('should not throw when token is unknown (idempotent)', async () => {
      tokenRepo.findOne.mockResolvedValue(null);

      await expect(service.logout(rawToken)).resolves.not.toThrow();
      expect(tokenRepo.update).not.toHaveBeenCalled();
    });
  });
});
