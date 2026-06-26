import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OfferItemVariantDto {
  @ApiProperty({ example: 'uuid', required: false })
  @IsOptional()
  @IsUUID('4')
  factory_id?: string;

  @ApiProperty({ example: 'Toshkent Beton zavodi' })
  @IsString({ message: "factory_name string bo'lishi kerak" })
  @IsNotEmpty({ message: "factory_name bo'sh bo'lmasligi kerak" })
  factory_name: string;

  @ApiProperty({ example: 'Toshkent sh, Chilonzor tumani' })
  @IsString({ message: "address string bo'lishi kerak" })
  @IsNotEmpty({ message: "address bo'sh bo'lmasligi kerak" })
  address: string;

  @ApiProperty({ example: 'Beton M300 Premium' })
  @IsString({ message: "product_name string bo'lishi kerak" })
  @IsNotEmpty({ message: "product_name bo'sh bo'lmasligi kerak" })
  product_name: string;

  @ApiProperty({ example: 150000 })
  @IsNumber({}, { message: "cost_price son bo'lishi kerak" })
  @Min(0, { message: "cost_price 0 dan katta bo'lishi kerak" })
  cost_price: number;

  @ApiPropertyOptional({ example: 180000 })
  @IsNumber({}, { message: "sale_price son bo'lishi kerak" })
  @Min(0, { message: "sale_price 0 dan katta bo'lishi kerak" })
  @IsOptional()
  sale_price: number;

  @ApiProperty({ example: 'uuid', required: false })
  @IsOptional()
  @IsUUID('4')
  sale_type_id?: string;

  @ApiProperty()
  @IsBoolean({ message: "is_delivery boolean bo'lishi kerak" })
  is_delivery: boolean;
}

export class CreateOfferItemVariantsDto {
  @ApiProperty({ description: 'Offer item ID', example: 'uuid' })
  @IsUUID('4', {
    message: "offer_item_id to'g'ri UUID formatda bo'lishi kerak",
  })
  @IsNotEmpty({ message: "offer_item_id bo'sh bo'lmasligi kerak" })
  offer_item_id: string;

  @ApiProperty({
    description: 'Variantlar (max 5 ta)',
    type: [OfferItemVariantDto],
  })
  @IsArray({ message: "variants massiv bo'lishi kerak" })
  @ValidateNested({ each: true })
  @Type(() => OfferItemVariantDto)
  variants: OfferItemVariantDto[];
}
