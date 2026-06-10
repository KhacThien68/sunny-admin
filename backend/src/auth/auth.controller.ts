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
    const rawToken: string | undefined = req.cookies?.['refresh_token'];
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
    const rawToken: string | undefined = req.cookies?.['refresh_token'];
    if (rawToken) {
      await this.authService.logout(rawToken);
    }
    res.clearCookie('refresh_token', { path: '/api/auth' });
    return { success: true };
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/auth',
      maxAge: 7 * 24 * 3600 * 1000,
    });
  }
}
