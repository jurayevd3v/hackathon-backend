import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { LocalProductsService } from './local_products.service';
import { CreateLocalProductDto } from './dto/create-local_product.dto';
import { UpdateLocalProductDto } from './dto/update-local_product.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles-auth-decorator';
import { UserRole } from '../common/enums/user-role.enum';

const ALL_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.FACTORY,
  UserRole.COMPANY,
];
@ApiTags('Local Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('local-products')
export class LocalProductsController {
  constructor(private readonly service: LocalProductsService) {}

  @ApiOperation({ summary: 'Create local product' })
  @Roles(...ALL_ROLES)
  @Post()
  create(@Body() dto: CreateLocalProductDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Get all local products by type and location' })
  @Roles(...ALL_ROLES)
  @Get('all/:location_id')
  findAll(@Param('location_id') location_id: string) {
    return this.service.findAll(location_id);
  }

  @ApiOperation({ summary: 'Get local products by type, location, category' })
  @Roles(...ALL_ROLES)
  @Get('by-category/:location_id/:category_id')
  findProduct(
    @Param('location_id') location_id: string,
    @Param('category_id') category_id: string,
  ) {
    return this.service.findProduct(location_id, category_id);
  }

  @ApiOperation({ summary: 'Paginate local products by category' })
  @ApiQuery({ name: 'name', required: false })
  @ApiQuery({ name: 'page', required: false })
  @Roles(...ALL_ROLES)
  @Get('paginate/:location_id/:category_id/page')
  paginate(
    @Param('location_id') location_id: string,
    @Param('category_id') category_id: string,
    @Query('name') name: string,
    @Query('page') page: number,
  ) {
    return this.service.paginate(location_id, category_id, name, page);
  }

  @ApiOperation({ summary: 'Paginate local products by location' })
  @ApiQuery({ name: 'name', required: false })
  @ApiQuery({ name: 'page', required: false })
  @Roles(...ALL_ROLES)
  @Get('paginateProduct/:location_id/page')
  paginateProduct(
    @Param('location_id') location_id: string,
    @Query('name') name: string,
    @Query('page') page: number,
  ) {
    return this.service.paginateProduct(location_id, name, page);
  }

  @ApiOperation({ summary: 'Search local products by name' })
  @Roles(...ALL_ROLES)
  @Get('by-name/:name')
  findName(@Param('name') name: string) {
    return this.service.findName(name);
  }

  @ApiOperation({ summary: 'Search local products' })
  @ApiQuery({ name: 'name', required: false })
  @ApiQuery({ name: 'address', required: false })
  @ApiQuery({ name: 'location_id', required: false })
  @ApiQuery({ name: 'page', required: false })
  @Roles(...ALL_ROLES)
  @Get('search')
  searchLocalProducts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('name') name?: string,
    @Query('address') address?: string,
    @Query('location_id') location_id?: string,
  ) {
    return this.service.searchLocalProducts({
      name,
      address,
      location_id,
      page,
    });
  }

  @ApiOperation({ summary: 'Update local product by ID' })
  @Roles(...ALL_ROLES)
  @Put('by-id/:id')
  update(@Param('id') id: string, @Body() dto: UpdateLocalProductDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete local product by ID' })
  @Roles(...ALL_ROLES)
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @ApiOperation({ summary: 'Get local product by ID' })
  @Roles(...ALL_ROLES)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
