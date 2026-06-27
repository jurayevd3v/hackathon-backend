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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { LocalCategoriesService } from './local_categories.service';
import { CreateLocalCategoryDto } from './dto/create-local_category.dto';
import { UpdateLocalCategoryDto } from './dto/update-local_category.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles-auth-decorator';
import { UserRole } from '../common/enums/user-role.enum';
const ADMIN_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.FACTORY,
  UserRole.COMPANY,
];

@ApiTags('Local Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('local-categories')
export class LocalCategoriesController {
  constructor(private readonly service: LocalCategoriesService) {}

  @ApiOperation({ summary: 'Create local category' })
  @Roles(...ADMIN_ROLES)
  @Post()
  create(@Body() dto: CreateLocalCategoryDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Get all local categories by type and location' })
  @Roles(...ADMIN_ROLES)
  @Get('all/:location_id')
  findAll(@Param('location_id') location_id: string) {
    return this.service.findAll(location_id);
  }

  @ApiOperation({ summary: 'Get local categories with pagination' })
  @ApiQuery({ name: 'name', required: false })
  @ApiQuery({ name: 'page', required: false })
  @Roles(...ADMIN_ROLES)
  @Get('paginate/:location_id/page')
  paginate(
    @Param('location_id') location_id: string,
    @Query('name') name: string,
    @Query('page') page: number,
  ) {
    return this.service.paginate(location_id, name, page);
  }

  @ApiOperation({ summary: 'Get local category by ID' })
  @Roles(...ADMIN_ROLES)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Update local category by ID' })
  @Roles(...ADMIN_ROLES)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLocalCategoryDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete local category by ID' })
  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
