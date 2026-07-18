import { IsObject, IsNotEmpty } from 'class-validator';

/**
 * Matches Go backend /settings/update request body:
 * flat key-value pairs like { "SITE_NAME": "xxx", "SITE_URL": "yyy" }.
 * Go swagger: type: object, additionalProperties: { type: string }.
 *
 * class-validator cannot validate dynamic keys on a plain class,
 * so validation is handled in the controller instead.
 */
export class UpdateSettingsRequestDto {
  @IsObject()
  @IsNotEmpty()
  settings!: Record<string, string>;
}
