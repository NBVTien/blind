import { Module } from '@nestjs/common';
import { WheelsController } from './wheels.controller';
import { WheelsService } from './wheels.service';

@Module({
  controllers: [WheelsController],
  providers: [WheelsService],
  exports: [WheelsService],
})
export class WheelsModule {}
