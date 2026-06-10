import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './refresh-token.entity';

const AUTH_ERROR = 'Sai tài khoản hoặc mật khẩu';
const SESSION_ERROR = 'Phiên đăng nhập không hợp lệ';

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly tokenRepo: Repository<RefreshToken>,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: object }> {
    const user = await this.usersService.findByEmailWithPassword(email);

    if (!user || !user.isActive || !user.passwordHash) {
      throw new UnauthorizedException(AUTH_ERROR);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException(AUTH_ERROR);
    }

    return this.issueTokens(user);
  }

  async refresh(
    rawToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: object }> {
    const tokenHash = sha256(rawToken);
    const stored = await this.tokenRepo.findOne({
      where: {
        tokenHash,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!stored) {
      throw new UnauthorizedException(SESSION_ERROR);
    }

    const user = await this.usersService.findById(stored.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException(SESSION_ERROR);
    }

    // Revoke old token (rotation)
    await this.tokenRepo.update(stored.id, { revokedAt: new Date() });

    return this.issueTokens(user);
  }

  async logout(rawToken: string): Promise<void> {
    const tokenHash = sha256(rawToken);
    const stored = await this.tokenRepo.findOne({ where: { tokenHash } });
    if (!stored) return;
    await this.tokenRepo.update(stored.id, { revokedAt: new Date() });
  }

  private async issueTokens(user: {
    id: number;
    name: string;
    email: string;
    isAdmin: boolean;
  }): Promise<{ accessToken: string; refreshToken: string; user: object }> {
    const ttl = this.configService.get<string>('JWT_ACCESS_TTL') ?? '900s';
    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, isAdmin: user.isAdmin },
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: parseInt(ttl, 10) || (ttl as any),
      },
    );

    const refreshToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = sha256(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

    await this.tokenRepo.save({ userId: user.id, tokenHash, expiresAt, revokedAt: null });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
      },
    };
  }
}
