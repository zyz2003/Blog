import { Global, Module } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { StatisticsModule } from '../statistics/statistics.module';

@Global()
@Module({
  imports: [StatisticsModule],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
