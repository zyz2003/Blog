import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used to mark routes as public (skip authentication).
 * When IS_PUBLIC_KEY is set to true on a handler or controller,
 * JwtAuthGuard will skip authentication for that route.
 *
 * Per D-08: JwtAuthGuard registered globally (APP_GUARD), public routes
 * use custom @Public() decorator to skip auth.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
