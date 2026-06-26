import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsUUID,
  Min,
  ValidateNested,
  ArrayMaxSize,
  ArrayMinSize,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateOfferItemVarian {
  @ApiProperty({ description: 'Offer item ID', example: 'uuid' })
  @IsUUID('4', {
    message: "offer_item_id to'g'ri UUID formatda bo'lishi kerak",
  })
  @IsNotEmpty({ message: "offer_item_id bo'sh bo'lmasligi kerak" })
  variant_id: string;

  @ApiPropertyOptional({ example: 180000 })
  @IsNumber({}, { message: "sale_price son bo'lishi kerak" })
  @Min(0, { message: "sale_price 0 dan katta bo'lishi kerak" })
  @IsOptional()
  sale_price: number;
}

export class UpdateOfferItemVariantsDto {
  @ApiProperty({
    description: 'Variantlar (max 5 ta)',
    type: [UpdateOfferItemVarian],
  })
  @IsArray({ message: "variants massiv bo'lishi kerak" })
  @ArrayMinSize(1, { message: "kamida 1 ta variant bo'lishi kerak" })
  @ArrayMaxSize(5, { message: "ko'pi bilan 5 ta variant bo'lishi mumkin" })
  @ValidateNested({ each: true })
  @Type(() => UpdateOfferItemVarian)
  variants: UpdateOfferItemVarian[];
}
