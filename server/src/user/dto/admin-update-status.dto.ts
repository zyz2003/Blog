import { IsNumber, IsIn } from 'class-validator';

export class AdminUpdateStatusDto {
  @IsNumber()
  @IsIn([1, 2, 3])
  status: number;
}
