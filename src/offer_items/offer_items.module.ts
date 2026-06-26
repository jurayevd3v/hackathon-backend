import { Module } from '@nestjs/common';
import { OfferItemsService } from './offer_items.service';
import { OfferItemsController } from './offer_items.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { OfferItem } from './models/offer_item.model';
import { JwtModule } from '@nestjs/jwt';
import { Offer } from '../offers/models/offer.model';

@Module({
  imports: [SequelizeModule.forFeature([OfferItem, Offer]), JwtModule],
  controllers: [OfferItemsController],
  providers: [OfferItemsService],
})
export class OfferItemsModule {}
