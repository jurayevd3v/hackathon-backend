import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Query,
  Put,
  Req,
} from '@nestjs/common';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { UpdateOfferStatusDto } from './dto/update-offer-status.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles-auth-decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard, JwtPayload } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateOfferPaidSumDto } from './dto/update-offer-paid-sum.dto';

const ADMIN_BROKER_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

const CLIENT_ROLES = [UserRole.COMPANY];

const ALL_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COMPANY];

@ApiTags('Offers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @ApiOperation({ summary: 'Create offer' })
  @Roles(...CLIENT_ROLES, UserRole.ADMIN)
  @Post()
  createOffer(
    @Body() dto: CreateOfferDto,
    @Req() req: Request & { user: JwtPayload; clientIp: string },
  ) {
    return this.offersService.createOffer(dto, req.user.id);
  }

  @ApiOperation({ summary: "Status bo'yicha offerlarni sahifalash" })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiQuery({ name: 'status', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get('page')
  getPaginatedOffers(
    @Query('status') status: string,
    @Query('page') page: number,
    @Query('limit') limit?: number,
  ) {
    return this.offersService.getPaginatedOffers(status, page, limit);
  }

  @ApiOperation({ summary: 'Barcha offerlarni sahifalash' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get('all')
  getPaginatedOffersAll(
    @Query('page') page: number,
    @Query('limit') limit?: number,
  ) {
    return this.offersService.getPaginatedOffersAll(page, limit);
  }

  @ApiOperation({ summary: "Location bo'yicha offerlarni sahifalash" })
  @Roles(...ALL_ROLES)
  @ApiQuery({ name: 'location_id', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get('location')
  getPaginatedOffersByLocation(
    @Query('location_id') location_id: string,
    @Query('page') page: number,
    @Query('limit') limit?: number,
  ) {
    return this.offersService.getPaginatedOffersByLocation(
      location_id,
      page,
      limit,
    );
  }

  @ApiOperation({ summary: 'Filter offers by location address and created_by' })
  @ApiQuery({ name: 'address', required: false })
  @ApiQuery({ name: 'created_by', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get('filter')
  filterOffers(
    @Query('address') address?: string,
    @Query('created_by') created_by?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.offersService.findAllOffersWithFilter(
      address,
      created_by,
      page,
      limit,
    );
  }
  @ApiOperation({
    summary: 'Filter offers by location address and search term',
  })
  @ApiQuery({ name: 'searchTerm', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get('search')
  searchOffersByTerm(
    @Query('searchTerm') searchTerm?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.offersService.findAllOffersBySearchTerm(
      searchTerm,
      page,
      limit,
    );
  }

  @ApiOperation({ summary: "Offer ID bo'yicha olish" })
  @Roles(...ADMIN_BROKER_ROLES, ...CLIENT_ROLES)
  @Get(':id')
  getOfferById(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload; clientIp: string },
  ) {
    return this.offersService.getOfferById(id, req.user);
  }

  @ApiOperation({ summary: "Offer ID bo'yicha yangilash" })
  @Roles(...ADMIN_BROKER_ROLES)
  @Put(':id')
  updateOffer(@Param('id') id: string, @Body() dto: UpdateOfferDto) {
    return this.offersService.updateOffer(id, dto);
  }

  @ApiOperation({ summary: 'Offer statusini yangilash' })
  @Roles(...ADMIN_BROKER_ROLES, ...CLIENT_ROLES)
  @Put('status/:id')
  updateOfferStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOfferStatusDto,
  ) {
    return this.offersService.updateOfferStatus(id, dto);
  }

  @ApiOperation({ summary: "Offer to'lov summasini yangilash" })
  @Roles(...ADMIN_BROKER_ROLES)
  @Put('paid-sum/:id')
  updateOfferPaidSum(
    @Param('id') id: string,
    @Body() dto: UpdateOfferPaidSumDto,
  ) {
    return this.offersService.updateOfferPaidSum(id, dto);
  }

  @ApiOperation({ summary: "Offer ID bo'yicha o'chirish" })
  @Roles(...ADMIN_BROKER_ROLES)
  @Delete(':id')
  deleteOffer(@Param('id') id: string) {
    return this.offersService.deleteOffer(id);
  }
}
