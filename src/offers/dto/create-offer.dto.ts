import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

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

  @ApiProperty({ example: 150000, description: 'Mahsulot tan narxi' })
  @Type(() => Number)
  @IsNumber({}, { message: "Tan narx raqam bo'lishi kerak" })
  cost_price: number;

  @ApiProperty({
    example: 'dona',
    description: "O'lchov birligi (dona, kg, m², m)",
  })
  @IsString({ message: "O'lchov birligi matn bo'lishi kerak" })
  @IsNotEmpty({ message: "O'lchov birligi bo'sh bo'lmasligi kerak" })
  unit: string;

  @ApiProperty({
    example: 5,
    description: "Miqdor (og'irlik/hajm)",
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber({}, { message: "Miqdor raqam bo'lishi kerak" })
  @Min(0, { message: "Miqdor 0 dan kichik bo'lmasligi kerak" })
  quantity: number;
}

export class CreateOfferDto {
  @ApiProperty({ example: 'id', description: 'Joylashuv ID' })
  @IsString({ message: "location_id matn bo'lishi kerak" })
  @IsNotEmpty({ message: "location_id bo'sh bo'lmasligi kerak" })
  location_id: string;

  @ApiPropertyOptional({
    example: 'Maxsus buyurtma mahsulot',
    description: 'Qurilish obyektining nomi',
  })
  @IsString({
    message: "Qurilish obyektining nomi matn ko'rinishida bo'lishi kerak",
  })
  @IsOptional()
  construction_site_name?: string;

  @ApiPropertyOptional({
    example: 'Fast Delivery Co.',
    description: 'Izoh name',
  })
  @IsOptional()
  @IsString({
    message: 'Izoh name matn formatida bo‘lishi kerak',
  })
  note?: string;

  @ApiProperty({
    type: [OfferItemDto],
    description: 'Offer mahsulotlari',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfferItemDto)
  items: OfferItemDto[];

  @ApiPropertyOptional({
    example: '2026-02-05T12:00:00Z',
    description: 'Offer sanasi',
  })
  @IsOptional()
  @IsDateString({}, { message: 'date ISO formatida bo‘lishi kerak' })
  date?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Logistika bo‘limi ishtirok etadimi',
  })
  @IsOptional()
  @IsBoolean({ message: 'is_logist boolean bo‘lishi kerak' })
  is_logist?: boolean;

  @ApiPropertyOptional({ example: 'address', description: 'offer address' })
  @IsString({ message: 'address matn (string) bo‘lishi kerak' })
  @IsOptional()
  address?: string;
}
