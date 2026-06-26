import { UserRole } from '../common/enums/user-role.enum';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Put,
  Patch,
  Query,
} from '@nestjs/common';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateLocationActiveDto } from './dto/update-location-active.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles-auth-decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { LocationService } from './location.service';

const ADMIN_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.COMPANY,
  UserRole.FACTORY,
];

@ApiTags('Locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('location')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @ApiOperation({ summary: 'Create location' })
  @Roles(...ADMIN_ROLES)
  @Post()
  async createLocation(@Body() dto: CreateLocationDto) {
    return this.locationService.createLocation(dto);
  }

  @ApiOperation({ summary: 'Get all locations' })
  @Roles(...ADMIN_ROLES)
  @ApiQuery({ name: 'page', required: false })
  @Get()
  getAllLocations(@Query('page') page: number) {
    return this.locationService.getAllLocations(page);
  }

  @ApiOperation({ summary: 'Get location by ID' })
  @Roles(...ADMIN_ROLES)
  @Get(':id')
  getLocationById(@Param('id') id: string) {
    return this.locationService.getLocationById(id);
  }

  @ApiOperation({ summary: 'Update location by ID' })
  @Roles(...ADMIN_ROLES)
  @Put(':id')
  async updateLocation(
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.locationService.updateLocation(id, dto);
  }

  @ApiOperation({ summary: 'Update location active status' })
  @Roles(...ADMIN_ROLES)
  @Patch('active/:id')
  async updateLocationActive(
    @Param('id') id: string,
    @Body() dto: UpdateLocationActiveDto,
  ) {
    return this.locationService.updateLocationActive(id, dto);
  }

  @ApiOperation({ summary: "Joylashuvni o'chirish" })
  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  async deleteLocation(@Param('id') id: string) {
    return this.locationService.deleteLocation(id);
  }
}
