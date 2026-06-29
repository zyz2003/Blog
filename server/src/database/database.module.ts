import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

export const DRIZZLE = 'DRIZZLE';

@Module({
  providers: [
    DatabaseService,
    {
      provide: DRIZZLE,
      useFactory: (service: DatabaseService) => service.getDb(),
      inject: [DatabaseService],
    },
  ],
  exports: [DRIZZLE, DatabaseService],
})
export class DatabaseModule {}
