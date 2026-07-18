import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GetByKeysRequestDto } from './dto/get-by-keys-request.dto';
import { UpdateSettingsRequestDto } from './dto/update-settings-request.dto';
import { decodePublicID, EntityType } from '../common/utils/sqids.util';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @HttpCode(HttpStatus.OK)
  @Post('get-by-keys')
  @UseGuards(JwtAuthGuard)
  getByKeys(
    @Body() dto: GetByKeysRequestDto,
    @CurrentUser() user: any,
  ): Record<string, any> {
    const isAdmin = this.isAdmin(user);
    return this.settingsService.getByKeys(dto.keys, isAdmin);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(@Body() dto: UpdateSettingsRequestDto): Promise<null> {
    await this.settingsService.update(dto.settings);
    return null;
  }

  @HttpCode(HttpStatus.OK)
  @Post('test-email')
  @UseGuards(JwtAuthGuard, AdminGuard)
  testEmail(): never {
    throw new HttpException('邮件服务未配置', HttpStatus.NOT_IMPLEMENTED);
  }

  private isAdmin(user: any): boolean {
    if (!user?.user_group_id) return false;
    try {
      const decoded = decodePublicID(user.user_group_id);
      return decoded.entityType === EntityType.UserGroup && decoded.dbID === 1;
    } catch {
      return false;
    }
  }
}

@Controller('public/site-config')
export class SiteConfigController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Public()
  getSiteConfig(): Record<string, any> {
    return this.settingsService.getSiteConfig();
  }

  @Get('version')
  @Public()
  getConfigVersion(): { version: number } {
    return this.settingsService.getConfigVersion();
  }
}
