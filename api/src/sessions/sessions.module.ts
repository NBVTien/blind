import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { MapsModule } from '../maps/maps.module';
import { ItemsModule } from '../items/items.module';
import { WheelsModule } from '../wheels/wheels.module';
import { GameConfigModule } from '../game-config/game-config.module';

@Module({
  imports: [MapsModule, ItemsModule, WheelsModule, GameConfigModule],
  controllers: [SessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}
