import { PartialType } from '@nestjs/swagger';
import { CreateOfferItemDto } from './create-offer_item.dto';

export class UpdateOfferItemDto extends PartialType(CreateOfferItemDto) {}
