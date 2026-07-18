import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminGuard } from '../common/guards/admin.guard';
import { CommentService } from './comment.service';
import { AdminListCommentDto } from './dto/admin-list-comment.dto';
import { DeleteCommentDto } from './dto/delete-comment.dto';
import { UpdateContentCommentDto } from './dto/update-content-comment.dto';
import { UpdateCommentInfoDto } from './dto/update-comment-info.dto';
import { UpdateStatusCommentDto } from './dto/update-status-comment.dto';
import { SetPinCommentDto } from './dto/set-pin-comment.dto';
import { ExportCommentsDto } from './dto/export-comments.dto';
import type { Request, Response } from 'express';

/**
 * CommentAdminController handles all admin-only comment endpoints.
 * Mounted at /api/comments — matches Go commentsAdmin route group
 * (router.go lines 279-288).
 *
 * All endpoints require JWT + Admin via @UseGuards(AdminGuard) at class level.
 * No @Public() decorator — these routes require authentication.
 *
 * AdminGuard verifies:
 * 1. JWT is valid (set by global JwtAuthGuard)
 * 2. UserGroupID decodes to admin group (dbID=1)
 */
@Controller('comments')
@UseGuards(AdminGuard)
export class CommentAdminController {
  constructor(private readonly commentService: CommentService) {}

  /**
   * GET /api/comments
   * Admin list with dynamic filters and pagination.
   * Matches Go AdminList (router.go line 281).
   * Returns comments with admin-only fields (email, ip_address, content, status).
   */
  @Get()
  async adminList(@Query() dto: AdminListCommentDto) {
    return this.commentService.adminList(dto);
  }

  /**
   * DELETE /api/comments
   * Soft-delete comments by IDs.
   * Matches Go Delete (router.go line 282).
   * Per D-136: uses soft delete (sets deletedAt).
   */
  @Delete()
  async delete(@Body() dto: DeleteCommentDto) {
    return this.commentService.delete(dto.ids);
  }

  /**
   * PUT /api/comments/:id
   * Update comment content and re-render HTML.
   * Matches Go UpdateContent (router.go line 283).
   * Per D-137: service re-renders Markdown after content update.
   */
  @Put(':id')
  async updateContent(
    @Param('id') id: string,
    @Body() dto: UpdateContentCommentDto,
  ) {
    return this.commentService.updateContent(id, dto.content);
  }

  /**
   * PUT /api/comments/:id/info
   * Update comment user info (nickname, email, website).
   * Matches Go UpdateCommentInfo (router.go line 284).
   * Per D-137: updates nickname/email/website, recomputes emailMd5 if email changed.
   */
  @Put(':id/info')
  async updateCommentInfo(
    @Param('id') id: string,
    @Body() dto: UpdateCommentInfoDto,
  ) {
    return this.commentService.updateCommentInfo(id, dto);
  }

  /**
   * PUT /api/comments/:id/status
   * Update comment status (1=Published, 2=Pending, 3=Rejected).
   * Matches Go UpdateStatus (router.go line 285).
   */
  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusCommentDto,
  ) {
    return this.commentService.updateStatus(id, dto.status);
  }

  /**
   * PUT /api/comments/:id/pin
   * Set or clear pin on a comment.
   * Matches Go SetPin (router.go line 286).
   * Per D-134: pinned=true sets pinnedAt=now, pinned=false clears pinnedAt.
   */
  @Put(':id/pin')
  async setPin(@Param('id') id: string, @Body() dto: SetPinCommentDto) {
    return this.commentService.setPin(id, dto.pinned);
  }

  /**
   * POST /api/comments/export
   * Export comments as JSON file.
   * Matches Go ExportComments (router.go line 287).
   * Frontend expects responseType: 'blob'.
   * Returns JSON buffer directly (Go returns ZIP but frontend's axios handles blob).
   */
  @Post('export')
  @HttpCode(HttpStatus.OK)
  async exportComments(
    @Body() dto: ExportCommentsDto,
    @Res() res: Response,
  ) {
    const jsonBuffer = await this.commentService.exportComments(dto.ids ?? []);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=comments_export.json',
    );
    res.setHeader('Content-Length', jsonBuffer.length.toString());
    res.send(jsonBuffer);
  }

  /**
   * POST /api/comments/import
   * Import comments from a JSON file.
   * Matches Go ImportComments (router.go line 288).
   * Accepts multipart/form-data with 'file' field and optional parameters.
   */
  @Post('import')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async importComments(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) {
      return {
        total_count: 0,
        success_count: 0,
        skipped_count: 0,
        failed_count: 1,
        error_messages: ['No file uploaded'],
        imported: 0,
        skipped: 0,
        errors: ['No file uploaded'],
      };
    }

    const options = {
      skipExisting:
        req.body?.skip_existing === 'false' ? false : true,
      defaultStatus: parseInt(req.body?.default_status || '1', 10),
      keepCreateTime:
        req.body?.keep_create_time === 'false' ? false : true,
    };

    const result = await this.commentService.importComments(
      file.buffer,
      options,
    );

    return result;
  }
}
