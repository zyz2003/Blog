import { IsArray, IsString } from 'class-validator';

export class MoveItemsDto {
  @IsArray()
  @IsString({ each: true })
  sourceIDs: string[];

  @IsString()
  destinationID: string;
}
