import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class OfferItemDto {
  @ApiProperty({
    example: 'Maxsus buyurtma mahsulot',
    description: 'Mahsulot nomi',
  })
  @IsString({ message: "Mahsulot nomi matn bo'lishi kerak" })
  @IsNotEmpty({ message: "Mahsulot nomi bo'sh bo'lmasligi kerak" })
  product_name: string;

  @ApiProperty({
    example: 100000,
    description: 'Mijoz mahsulot narxi',
  })
  @Type(() => Number)
  @IsNumber({}, { message: "Mijoz mahsulot narx raqam bo'lishi kerak" })
  @Min(0, { message: "Mijoz mahsulot 0 dan kichik bo'lmasligi kerak" })
  customer_price: number;

  @ApiProperty({
    example: 100000,
    description: 'Mahsulot tan narxi',
  })
  @Type(() => Number)
  @IsNumber({}, { message: "Tan narx raqam bo'lishi kerak" })
  @Min(0, { message: "Tan narx 0 dan kichik bo'lmasligi kerak" })
  cost_price: number;

  @ApiProperty({
    example: 'dona',
    description: "O'lchov birligi (dona, kg, m², m)",
  })
  @IsString({ message: "O'lchov birligi matn bo'lishi kerak" })
  @IsNotEmpty({ message: "O'lchov birligi bo'sh bo'lmasligi kerak" })
  unit: string;

  @ApiProperty({ example: 5, description: 'Miqdor', minimum: 0 })
  @Type(() => Number)
  @IsNumber({}, { message: "Miqdor raqam bo'lishi kerak" })
  @Min(0, { message: "Miqdor 0 dan kichik bo'lmasligi kerak" })
  quantity: number;
}

export class CreateOfferItemDto {
  @ApiProperty({ example: 'uuid-here', description: 'Offer ID' })
  @IsUUID('4', { message: "offer_id UUID formatida bo'lishi kerak" })
  @IsNotEmpty({ message: "offer_id bo'sh bo'lmasligi kerak" })
  offer_id: string;

  @ApiProperty({ example: 'uuid-here', description: 'Location ID' })
  @IsUUID('4', { message: "location_id UUID formatida bo'lishi kerak" })
  @IsNotEmpty({ message: "location_id bo'sh bo'lmasligi kerak" })
  location_id: string;

  @ApiProperty({ type: [OfferItemDto], description: "Offer itemlar ro'yxati" })
  @IsArray({ message: "items massiv bo'lishi kerak" })
  @ValidateNested({ each: true })
  @Type(() => OfferItemDto)
  items: OfferItemDto[];
}
