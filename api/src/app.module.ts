import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db.module';
import { MapsModule } from './maps/maps.module';
import { SessionsModule } from './sessions/sessions.module';
import { ItemsModule } from './items/items.module';
import { WheelsModule } from './wheels/wheels.module';
import { CellConfigModule } from './cell-config/cell-config.module';
import { GameConfigModule } from './game-config/game-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    MapsModule,
    SessionsModule,
    ItemsModule,
    WheelsModule,
    CellConfigModule,
    GameConfigModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
