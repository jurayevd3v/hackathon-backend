import { Module } from '@nestjs/common';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Offer } from './models/offer.model';
import { JwtModule } from '@nestjs/jwt';
import { OfferItem } from '../offer_items/models/offer_item.model';

@Module({
  imports: [SequelizeModule.forFeature([Offer, OfferItem]), JwtModule],
  controllers: [OffersController],
  providers: [OffersService],
})
export class OffersModule {}
