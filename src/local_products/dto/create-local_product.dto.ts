import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PriceItemDto {
  @ApiProperty({
    example: 1,
    description: 'Mahsulot miqdori',
  })
  @IsNotEmpty({ message: "quantity bo'sh bo'lishi mumkin emas!" })
  @IsNumber({}, { message: "quantity raqam bo'lishi shart!" })
  @Min(1, { message: "quantity 1 dan kichik bo'lishi mumkin emas!" })
  @IsOptional()
  quantity?: number;

  @ApiProperty({
    example: 15000,
    description: 'Mahsulot narxi',
  })
  @IsNotEmpty({ message: "price bo'sh bo'lishi mumkin emas!" })
  @IsNumber({}, { message: "price raqam bo'lishi shart!" })
  @Min(0, { message: "price 0 dan kichik bo'lishi mumkin emas!" })
  price: number;
}

export class PricesDto {
  @ApiProperty({
    example: { quantity: 1, price: 15000 },
    description: 'Alone narxi',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PriceItemDto)
  alone?: PriceItemDto;

  @ApiProperty({
    example: { quantity: 10, price: 13500 },
    description: 'Average narxi',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PriceItemDto)
  average?: PriceItemDto;

  @ApiProperty({
    example: { quantity: 50, price: 12000 },
    description: 'Wholesale narxi',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PriceItemDto)
  wholesale?: PriceItemDto;
}

export class CreateLocalProductDto {
  @ApiProperty({ example: 'Iphone 17', description: 'Product name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'TA', description: 'Product unit' })
  @IsString()
  @IsNotEmpty()
  unit: string;

  @ApiProperty({ example: 'uuid', description: 'Joylashuv ID' })
  @IsString()
  @IsNotEmpty()
  location_id: string;

  @ApiProperty({ example: 'uuid', description: 'Category ID' })
  @IsString()
  @IsNotEmpty()
  category_id: string;

  @ApiProperty({
    example: {
      alone: { quantity: 1, price: 15000 },
      average: { quantity: 10, price: 13500 },
      wholesale: { quantity: 50, price: 12000 },
    },
    description: 'Narxlar',
  })
  @IsNotEmpty({ message: "prices bo'sh bo'lishi mumkin emas!" })
  @IsObject({ message: "prices ob'ekt bo'lishi shart!" })
  @ValidateNested()
  @Type(() => PricesDto)
  prices: PricesDto;
}
