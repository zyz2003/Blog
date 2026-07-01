import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  HttpException,
  HttpStatus,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { CaptchaService } from '../captcha/captcha.service';
import { LoginRequestDto } from './dto/login-request.dto';
import { RefreshTokenRequestDto } from './dto/refresh-token-request.dto';
import { Public } from '../common/decorators/public.decorator';
import { ErrorCodes } from '../common/constants/error-codes';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly captchaService: CaptchaService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() dto: LoginRequestDto) {
    // Verify captcha before checking credentials (matches Go: captcha verified first)
    this.captchaService.verify({
      image_captcha_id: dto.image_captcha_id,
      image_captcha_answer: dto.image_captcha_answer,
    });

    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @Post('refresh-token')
  async refreshToken(
    @Headers('authorization') authorization: string,
    @Body() body: RefreshTokenRequestDto,
  ) {
    // Extract refresh token: Authorization header first, then body per D-32
    let refreshToken: string | undefined;

    if (authorization?.startsWith('Bearer ')) {
      refreshToken = authorization.slice(7);
    }

    if (!refreshToken) {
      refreshToken = body.refreshToken;
    }

    if (!refreshToken) {
      throw new UnauthorizedException(ErrorCodes.TOKEN_MISSING);
    }

    return this.tokenService.refreshAccessToken(refreshToken);
  }

  @Public()
  @Post('register')
  async register() {
    throw new HttpException('注册功能暂未开放', HttpStatus.NOT_IMPLEMENTED);
  }

  @Public()
  @Post('activate')
  async activate() {
    throw new HttpException('激活功能暂未开放', HttpStatus.NOT_IMPLEMENTED);
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword() {
    throw new HttpException('忘记密码功能暂未开放', HttpStatus.NOT_IMPLEMENTED);
  }

  @Public()
  @Post('reset-password')
  async resetPassword() {
    throw new HttpException('重置密码功能暂未开放', HttpStatus.NOT_IMPLEMENTED);
  }

  @Public()
  @Get('check-email')
  async checkEmail() {
    throw new HttpException('邮箱检查功能暂未开放', HttpStatus.NOT_IMPLEMENTED);
  }
}
