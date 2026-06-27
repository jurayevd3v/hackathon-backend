import {
  Controller,
  Body,
  Param,
  UseGuards,
  Put,
  Post,
  Get,
  Delete,
  Query,
} from '@nestjs/common';
import { OfferItemsService } from './offer_items.service';
import { CreateOfferItemDto } from './dto/create-offer_item.dto';
import { UpdateOfferItemDto } from './dto/update-offer_item.dto';
import { UpdateOfferItemActiveDto } from './dto/update-offer_item-active.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles-auth-decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateOfferItemStatusDto } from './dto/update-offer_item-status.dto';
import { UpdateOfferItemDeliveryDto } from './dto/update-offer_item-delivery.dto';
import { UpdateOfferItemFactoryPaymentDto } from './dto/update-offer_item-factory-payment.dto';
import { UpdateOfferItemDeliveredQuantityDto } from './dto/update-offer_item-delivered-quantity.dto';
import { SelectOfferItemVariantDto } from './dto/select-offer_item-variant.dto';
import { UpdateOfferItemVariantsDto } from './dto/update-offer_item-variant.dto';

const ADMIN_BROKER_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.FACTORY,
  UserRole.COMPANY,
];

@ApiTags('Offer Items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('offer-items')
export class OfferItemsController {
  constructor(private readonly offerItemsService: OfferItemsService) {}

  @Roles(...ADMIN_BROKER_ROLES)
  @ApiOperation({ summary: 'Offer item yaratish' })
  @Post()
  createOfferItem(@Body() dto: CreateOfferItemDto) {
    return this.offerItemsService.createOfferItem(dto);
  }

  @ApiOperation({ summary: "Location bo'yicha offer itemlarni sahifalash" })
  @Roles(...ADMIN_BROKER_ROLES)
  @ApiQuery({ name: 'location_id', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get('location')
  getPaginatedItemsBySupplier(
    @Query('location_id') location_id: string,
    @Query('status') status: string,
    @Query('page') page: number,
    @Query('limit') limit?: number,
  ) {
    return this.offerItemsService.getPaginatedItemsBySupplier(
      location_id,
      status,
      page,
      limit,
    );
  }

  @ApiOperation({ summary: "Offer item ID bo'yicha olish" })
  @Roles(...ADMIN_BROKER_ROLES)
  @Get('bu-id/:id')
  getOfferItemById(@Param('id') id: string) {
    return this.offerItemsService.getOfferItemById(id);
  }

  @Roles(...ADMIN_BROKER_ROLES)
  @ApiOperation({ summary: 'Offer item faollik holatini yangilash' })
  @Put('active/:id')
  updateOfferItemActive(
    @Param('id') id: string,
    @Body() dto: UpdateOfferItemActiveDto,
  ) {
    return this.offerItemsService.updateOfferItemActive(id, dto);
  }

  @Roles(...ADMIN_BROKER_ROLES)
  @ApiOperation({ summary: 'Offer item statusini yangilash' })
  @Put('status/:id')
  updateOfferItemStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOfferItemStatusDto,
  ) {
    return this.offerItemsService.updateOfferItemStatus(id, dto);
  }

  @Roles(...ADMIN_BROKER_ROLES)
  @ApiOperation({ summary: "Delivery ma'lumotlarini yangilash" })
  @Put('delivery/:id')
  updateDelivery(
    @Param('id') id: string,
    @Body() dto: UpdateOfferItemDeliveryDto,
  ) {
    return this.offerItemsService.updateOfferItemDelivery(id, dto);
  }

  @Roles(...ADMIN_BROKER_ROLES)
  @ApiOperation({ summary: "Zavod to'lov ma'lumotlarini yangilash" })
  @Put('factory-payment/:id')
  updateFactoryPayment(
    @Param('id') id: string,
    @Body() dto: UpdateOfferItemFactoryPaymentDto,
  ) {
    return this.offerItemsService.updateOfferItemFactoryPayment(id, dto);
  }

  @Roles(...ADMIN_BROKER_ROLES)
  @ApiOperation({ summary: 'Yetkazilgan miqdorni yangilash' })
  @Put('delivered-quantity/:id')
  updateDeliveredQuantity(
    @Param('id') id: string,
    @Body() dto: UpdateOfferItemDeliveredQuantityDto,
  ) {
    return this.offerItemsService.updateOfferItemDeliveredQuantity(id, dto);
  }

  @Roles(...ADMIN_BROKER_ROLES)
  @ApiOperation({ summary: 'Variantlarni yangilash' })
  @Put('variants/:id')
  updateOfferItemVariants(
    @Param('id') id: string,
    @Body() dto: UpdateOfferItemVariantsDto,
  ) {
    return this.offerItemsService.updateOfferItemVariants(id, dto);
  }

  @Roles(...ADMIN_BROKER_ROLES)
  @ApiOperation({ summary: 'Variant tanlash (buyurtmachi)' })
  @Put('select-variant/:id')
  selectVariant(
    @Param('id') id: string,
    @Body() dto: SelectOfferItemVariantDto,
  ) {
    return this.offerItemsService.selectOfferItemVariant(id, dto.variant_id);
  }

  @Roles(...ADMIN_BROKER_ROLES)
  @ApiOperation({ summary: "Offer item ID bo'yicha yangilash" })
  @Put(':id')
  updateOfferItem(@Param('id') id: string, @Body() dto: UpdateOfferItemDto) {
    return this.offerItemsService.updateOfferItem(id, dto);
  }

  @Roles(...ADMIN_BROKER_ROLES)
  @ApiOperation({ summary: "Variantni o'chirish" })
  @Delete('variants/:id/:variant_id')
  deleteOfferItemVariant(
    @Param('id') id: string,
    @Param('variant_id') variant_id: string,
  ) {
    return this.offerItemsService.deleteOfferItemVariant(id, variant_id);
  }
}
