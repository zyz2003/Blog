import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';
import { CommentService } from './comment.service';
import { AdminListCommentDto } from './dto/admin-list-comment.dto';
import { DeleteCommentDto } from './dto/delete-comment.dto';
import { UpdateContentCommentDto } from './dto/update-content-comment.dto';
import { UpdateCommentInfoDto } from './dto/update-comment-info.dto';
import { UpdateStatusCommentDto } from './dto/update-status-comment.dto';
import { SetPinCommentDto } from './dto/set-pin-comment.dto';

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
}
