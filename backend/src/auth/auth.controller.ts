import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH, REFRESH_TTL_MS } from './auth.constants';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.authService.login(
      dto.email,
      dto.password,
    );
    this.setRefreshCookie(res, refreshToken);
    return { accessToken, user };
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken: string | undefined = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rawToken) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }
    const { accessToken, refreshToken, user } = await this.authService.refresh(rawToken);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken, user };
  }

  @Public()
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken: string | undefined = req.cookies?.[REFRESH_COOKIE_NAME];
    if (rawToken) {
      await this.authService.logout(rawToken);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
    return { success: true };
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: REFRESH_COOKIE_PATH,
      maxAge: REFRESH_TTL_MS,
    });
  }
}
