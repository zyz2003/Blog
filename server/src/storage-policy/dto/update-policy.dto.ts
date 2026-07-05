import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsObject,
} from 'class-validator';

export class UpdatePolicyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  flag?: string;

  @IsOptional()
  @IsString()
  server?: string;

  @IsOptional()
  @IsString()
  bucketName?: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  @IsString()
  accessKey?: string;

  @IsOptional()
  @IsString()
  secretKey?: string;

  @IsOptional()
  @IsNumber()
  maxSize?: number;

  @IsOptional()
  @IsString()
  basePath?: string;

  @IsOptional()
  @IsString()
  virtualPath?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  nodeId?: number;
}
