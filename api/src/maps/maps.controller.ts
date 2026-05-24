import { Controller, Get, Post, Delete, Patch, Param, Body } from '@nestjs/common';
import { MapsService } from './maps.service';
import { CreateMapDto } from './dto/create-map.dto';
import { UpdateCellDto } from './dto/update-cell.dto';
import { ToggleEdgeDto } from './dto/toggle-edge.dto';

@Controller('maps')
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get()
  findAll() { return this.mapsService.findAll(); }

  @Post()
  create(@Body() dto: CreateMapDto) { return this.mapsService.create(dto); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.mapsService.findOne(Number(id)); }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.mapsService.remove(Number(id));
    return { deleted: true };
  }

  @Patch(':id')
  updateName(@Param('id') id: string, @Body('name') name: string) {
    return this.mapsService.updateName(Number(id), name);
  }

  @Patch(':id/cell/:cellId')
  updateCell(@Param('id') id: string, @Param('cellId') cellId: string, @Body() dto: UpdateCellDto) {
    return this.mapsService.updateCell(Number(id), cellId, dto);
  }

  @Patch(':id/edge')
  toggleEdge(@Param('id') id: string, @Body() dto: ToggleEdgeDto) {
    return this.mapsService.toggleEdge(Number(id), dto);
  }
}
