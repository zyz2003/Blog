import { Controller, Get, Post, Put, Body, Param, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { FileService } from './file.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MoveItemsDto } from './dto/move-items.dto';
import { CopyItemsDto } from './dto/copy-items.dto';
import { UpdateViewConfigDto } from './dto/update-view-config.dto';
import { decodePublicID, EntityType } from '../common/utils/sqids.util';

/**
 * FolderController at /api/folder/*
 * Per RESEARCH Pitfall 6: registered at @Controller('folder'), NOT @Controller('file/folder')
 * All endpoints require JWT (enforced by global JwtAuthGuard)
 */
@Controller('folder')
export class FolderController {
  constructor(private readonly fileService: FileService) {}

  @Put('view')
  async updateFolderView(
    @Body() dto: UpdateViewConfigDto,
    @CurrentUser() user: any,
  ) {
    return this.fileService.updateFolderView(dto.folder_id, dto.view);
  }

  @Get('tree/:id')
  async getFolderTree(
    @Param('id') publicID: string,
    @CurrentUser() user: any,
  ) {
    const ownerId = this.extractOwnerDbId(user);
    return this.fileService.getFolderTree(publicID, ownerId);
  }

  @Get('size/:id')
  async getFolderSize(@Param('id') publicID: string) {
    return this.fileService.getFolderSize(publicID);
  }

  @HttpCode(HttpStatus.OK)
  @Post('move')
  async moveItems(
    @Body() dto: MoveItemsDto,
    @CurrentUser() user: any,
  ) {
    const ownerId = this.extractOwnerDbId(user);
    return this.fileService.moveItems(dto.sourceIDs, dto.destinationID, ownerId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('copy')
  async copyItems(
    @Body() dto: CopyItemsDto,
    @CurrentUser() user: any,
  ) {
    const ownerId = this.extractOwnerDbId(user);
    return this.fileService.copyItems(dto.sourceIDs, dto.destinationID, ownerId);
  }

  private extractOwnerDbId(user: any): number {
    if (!user) return 1;
    if (user.dbId) return user.dbId;
    if (user.id) {
      try {
        const { dbID, entityType } = decodePublicID(user.id);
        if (entityType === EntityType.User) return dbID;
      } catch {
        // Not a Sqids ID
      }
    }
    return 1;
  }
}
