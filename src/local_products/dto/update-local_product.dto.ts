import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class UpdatePriceItemDto {
  @ApiProperty({
    example: 1,
    description:
      'Mahsulot miqdori (shu miqdordan boshlab ushbu narx amal qiladi)',
  })
  @IsNotEmpty({ message: "quantity bo'sh bo'lishi mumkin emas!" })
  @IsNumber({}, { message: "quantity raqam bo'lishi shart!" })
  @Min(1, { message: "quantity kamida 1 bo'lishi kerak!" })
  @IsOptional()
  quantity?: number;

  @ApiProperty({
    example: 14000,
    description: 'Yangi belgilangan miqdor uchun mahsulot narxi',
  })
  @IsNotEmpty({ message: "price bo'sh bo'lishi mumkin emas!" })
  @IsNumber({}, { message: "price raqam bo'lishi shart!" })
  @Min(0, { message: "price 0 dan kichik bo'lishi mumkin emas!" })
  price: number;
}

class UpdatePricesDto {
  @ApiProperty({ example: { quantity: 1, price: 14000 }, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePriceItemDto)
  alone?: UpdatePriceItemDto;

  @ApiProperty({ example: { quantity: 10, price: 12500 }, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePriceItemDto)
  average?: UpdatePriceItemDto;

  @ApiProperty({ example: { quantity: 50, price: 11000 }, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePriceItemDto)
  wholesale?: UpdatePriceItemDto;
}

export class UpdateLocalProductDto {
  @ApiProperty({ example: 'Iphone 17' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'TA' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  unit?: string;

  @ApiProperty({
    type: Object,
    description: "Yangilanayotgan narxlar ob'ekti",
    example: {
      alone: { quantity: 1, price: 14000 },
      average: { quantity: 10, price: 12500 },
      wholesale: { quantity: 50, price: 11000 },
    },
  })
  @IsOptional()
  @IsNotEmpty({ message: "prices bo'sh bo'lishi mumkin emas!" })
  @IsObject({ message: "prices ob'ekt bo'lishi shart!" })
  @ValidateNested()
  @Type(() => UpdatePricesDto)
  prices?: UpdatePricesDto;
}
