import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { StoragePolicyService } from './storage-policy.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('policies')
@UseGuards(AdminGuard)
export class StoragePolicyController {
  constructor(private readonly service: StoragePolicyService) {}

  @Post()
  async create(@Body() dto: CreatePolicyDto) {
    return this.service.create(dto);
  }

  @Get()
  async list(@Query() query: any) {
    const page = query.page ? parseInt(query.page, 10) : 1;
    const pageSize = Math.min(
      query.pageSize ? parseInt(query.pageSize, 10) : 10,
      100,
    );
    return this.service.list({ page, pageSize });
  }

  @Get(':id')
  async getById(@Param('id') publicID: string) {
    return this.service.getById(publicID);
  }

  @Put(':id')
  async update(@Param('id') publicID: string, @Body() dto: UpdatePolicyDto) {
    return this.service.update(publicID, dto);
  }

  @Delete(':id')
  async delete(@Param('id') publicID: string) {
    return this.service.delete(publicID);
  }

  // Deferred cloud storage endpoints — 501 stubs
  @Get('connect/onedrive/:id')
  async connectOnedrive() {
    throw new HttpException('功能暂未实现', HttpStatus.NOT_IMPLEMENTED);
  }

  @Post('authorize/onedrive')
  async authorizeOnedrive() {
    throw new HttpException('功能暂未实现', HttpStatus.NOT_IMPLEMENTED);
  }
}
