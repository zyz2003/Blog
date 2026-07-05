import { IsArray, IsString } from 'class-validator';

export class DeleteItemsDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}
