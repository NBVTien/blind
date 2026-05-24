import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { WheelsService } from './wheels.service';
import { CreateWheelDto } from './dto/create-wheel.dto';
import { UpdateWheelDto } from './dto/update-wheel.dto';

@Controller('wheels')
export class WheelsController {
  constructor(private readonly wheelsService: WheelsService) {}

  @Get()
  findAll() { return this.wheelsService.findAll(); }

  @Post()
  create(@Body() dto: CreateWheelDto) { return this.wheelsService.create(dto); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.wheelsService.findOne(Number(id)); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWheelDto) { return this.wheelsService.update(Number(id), dto); }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.wheelsService.remove(Number(id));
    return { deleted: true };
  }
}
