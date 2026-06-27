import { Module } from '@nestjs/common';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Offer } from './models/offer.model';
import { JwtModule } from '@nestjs/jwt';
import { OfferItem } from '../offer_items/models/offer_item.model';
import { GeocodeService } from '../common/geocode/service';
import { LocalProduct } from '../local_products/models/local_product.model';

@Module({
  imports: [
    SequelizeModule.forFeature([Offer, OfferItem, LocalProduct]),
    JwtModule,
  ],
  controllers: [OffersController],
  providers: [OffersService, GeocodeService],
})
export class OffersModule {}
