import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { StoragePolicyController } from './storage-policy.controller';
import { StoragePolicyService } from './storage-policy.service';
import { StoragePolicyRepository } from './storage-policy.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [StoragePolicyController],
  providers: [StoragePolicyService, StoragePolicyRepository],
  exports: [StoragePolicyService],
})
export class StoragePolicyModule {}
