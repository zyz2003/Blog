import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { decodePublicID, EntityType } from '../common/utils/sqids.util';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { AdminUpdateStatusDto } from './dto/admin-update-status.dto';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('user/info')
  async getUserInfo(@CurrentUser() user: any) {
    const decoded = decodePublicID(user.user_id);
    return this.userService.getUserInfo(decoded.dbID);
  }

  @HttpCode(HttpStatus.OK)
  @Post('user/update-password')
  async updatePassword(
    @CurrentUser() user: any,
    @Body() dto: UpdatePasswordDto,
  ) {
    const decoded = decodePublicID(user.user_id);
    await this.userService.updatePassword(decoded.dbID, dto.oldPassword, dto.newPassword);
    return null;
  }

  @Put('user/profile')
  async updateProfile(
    @CurrentUser() user: any,
    @Body() dto: UpdateProfileDto,
  ) {
    const decoded = decodePublicID(user.user_id);
    await this.userService.updateProfile(decoded.dbID, dto.nickname, dto.website);
    return null;
  }

  @HttpCode(HttpStatus.OK)
  @Post('user/avatar')
  async uploadAvatar() {
    throw new HttpException('头像上传功能暂未开放', HttpStatus.NOT_IMPLEMENTED);
  }

  @Get('admin/users')
  @UseGuards(AdminGuard)
  async adminListUsers(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('groupID') groupID?: string,
    @Query('status') status?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const ps = pageSize ? parseInt(pageSize, 10) : 10;

    let groupIDNum: number | undefined;
    if (groupID) {
      const decoded = decodePublicID(groupID);
      groupIDNum = decoded.dbID;
    }

    const statusNum = status ? parseInt(status, 10) : undefined;

    return this.userService.adminListUsers(p, ps, keyword, groupIDNum, statusNum);
  }

  @HttpCode(HttpStatus.OK)
  @Post('admin/users')
  @UseGuards(AdminGuard)
  async adminCreateUser(@Body() dto: AdminCreateUserDto) {
    return this.userService.adminCreateUser(dto);
  }

  @Put('admin/users/:id')
  @UseGuards(AdminGuard)
  async adminUpdateUser(@Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    await this.userService.adminUpdateUser(id, dto);
    return null;
  }

  @Delete('admin/users/:id')
  @UseGuards(AdminGuard)
  async adminDeleteUser(@Param('id') id: string) {
    await this.userService.adminDeleteUser(id);
    return null;
  }

  @HttpCode(HttpStatus.OK)
  @Post('admin/users/:id/reset-password')
  @UseGuards(AdminGuard)
  async adminResetPassword(@Param('id') id: string, @Body() dto: AdminResetPasswordDto) {
    await this.userService.adminResetPassword(id, dto.newPassword);
    return null;
  }

  @Put('admin/users/:id/status')
  @UseGuards(AdminGuard)
  async adminUpdateStatus(@Param('id') id: string, @Body() dto: AdminUpdateStatusDto) {
    await this.userService.adminUpdateStatus(id, dto.status);
    return null;
  }

  @Get('admin/user-groups')
  @UseGuards(AdminGuard)
  async getUserGroups() {
    return this.userService.getUserGroups();
  }
}
