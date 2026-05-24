import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  findAll() { return this.itemsService.findAll(); }

  @Post()
  create(@Body() dto: CreateItemDto) { return this.itemsService.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateItemDto>) { return this.itemsService.update(Number(id), dto); }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.itemsService.remove(Number(id));
    return { deleted: true };
  }
}
