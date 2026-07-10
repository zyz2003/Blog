import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthOptionalGuard } from '../common/guards/jwt-auth-optional.guard';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { FileInterceptor } from '@nestjs/platform-express';

/**
 * CommentController handles all public-facing comment endpoints.
 * Mounted at /api/public/comments — matches Go commentsPublic route group
 * (router.go lines 258-272).
 *
 * All endpoints use @Public() at class level — no auth required by default.
 * Create and upload use @UseGuards(JwtAuthOptionalGuard) for optional
 * JWT parsing (detect admin comments, associate with user).
 *
 * Route ordering: specific routes (latest, upload) declared BEFORE
 * parametric routes (:id/children, :id/like) to prevent 'latest'
 * being captured as :id param.
 */
@Public()
@Controller('public/comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  /**
   * GET /api/public/comments/latest
   * List latest published comments (flat paginated list).
   * Matches Go ListLatest (router.go line 261).
   * MUST be declared before @Get() to avoid 'latest' captured as :id.
   */
  @Get('latest')
  async listLatest(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.commentService.listLatest(
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 10,
    );
  }

  /**
   * GET /api/public/comments
   * List comments by target path with tree structure.
   * Matches Go ListByPath (router.go line 260).
   */
  @Get()
  async listByPath(
    @Query('target_path') targetPath: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.commentService.listByPath(
      targetPath,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 10,
    );
  }

  /**
   * GET /api/public/comments/qq-info
   * Get QQ nickname and avatar by QQ number.
   * Matches Go GetQQInfo (router.go line 258).
   * MUST be declared before @Get(':id/children') to avoid 'qq-info' captured as :id.
   */
  @Get('qq-info')
  async getQQInfo(@Query('qq') qq: string, @Req() req: any) {
    if (!qq) {
      return { nickname: '', avatar: '' };
    }
    const referer = req.headers['referer'] || '';
    return this.commentService.getQQInfo(qq, referer);
  }

  /**
   * GET /api/public/comments/ip-location
   * Get IP geolocation info (full structure matching Go IPLocationResponse).
   * Matches Go GetIPLocation (router.go line 265).
   * MUST be declared before @Get(':id/children') to avoid 'ip-location' captured as :id.
   */
  @Get('ip-location')
  async getIPLocation(@Req() req: any) {
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.ip ||
      req.connection?.remoteAddress ||
      '';
    const referer = req.headers['referer'] || '';
    return this.commentService.getIPLocation(ip, referer);
  }

  /**
   * GET /api/public/comments/:id/children
   * List children of a comment with preview mode.
   * Matches Go ListChildren (router.go line 263).
   * Default pageSize=3 for preview mode matching Go behavior.
   */
  @Get(':id/children')
  async listChildren(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.commentService.listChildren(
      id,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 3,
    );
  }

  /**
   * POST /api/public/comments
   * Create a new comment with optional JWT auth.
   * Matches Go Create (router.go line 269).
   * Uses JwtAuthOptionalGuard: parses token if present, passes if absent.
   * Extracts IP, User-Agent, Referer from request for spam detection
   * and geolocation.
   */
  @Post()
  @UseGuards(JwtAuthOptionalGuard)
  async create(@Body() dto: CreateCommentDto, @Req() req: any) {
    // Extract IP with proxy header support
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.ip ||
      req.connection?.remoteAddress ||
      '';
    const ua = req.headers['user-agent'] || '';
    const referer = req.headers['referer'] || '';

    // Claims set by JwtAuthOptionalGuard if JWT present
    const claims = req.user || null;

    return this.commentService.create(dto, ip, ua, referer, claims);
  }

  /**
   * POST /api/public/comments/upload
   * Upload comment image with optional JWT auth.
   * Matches Go UploadCommentImage (router.go line 270).
   * Per D-141, D-142: delegates to CommentService.uploadImage.
   * MUST be declared before @Post(':id/like') to avoid 'upload'
   * captured as :id.
   */
  @Post('upload')
  @UseGuards(JwtAuthOptionalGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const user = req.user || null;
    return this.commentService.uploadImage(file, user);
  }

  /**
   * POST /api/public/comments/:id/like
   * Like a comment — increment likeCount.
   * Matches Go LikeComment (router.go line 271).
   */
  @Post(':id/like')
  async like(@Param('id') id: string) {
    return this.commentService.likeComment(id);
  }

  /**
   * POST /api/public/comments/:id/unlike
   * Unlike a comment — decrement likeCount (min 0).
   * Matches Go UnlikeComment (router.go line 272).
   */
  @Post(':id/unlike')
  async unlike(@Param('id') id: string) {
    return this.commentService.unlikeComment(id);
  }
}
