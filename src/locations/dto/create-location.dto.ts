import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LocationType } from '../../common/enums/location-type.enum';

export class CreateLocationDto {
  @ApiProperty({
    enum: LocationType,
    example: LocationType.COMPANY,
    description: 'Joylashuv turi',
  })
  @IsEnum(LocationType, { message: 'type noto‘g‘ri kiritilgan' })
  type: LocationType;

  @ApiProperty({
    example: 'Tezkor Qurilish MCHJ',
    description: 'Nomi',
  })
  @IsString({ message: 'name matn (string) bo‘lishi kerak' })
  @IsNotEmpty({ message: 'name bo‘sh bo‘lishi mumkin emas' })
  name: string;

  @ApiPropertyOptional({
    example: 'Andijon viloyati, Andijon shahri',
    description: 'Manzil',
  })
  @IsOptional()
  @IsString({ message: 'address matn (string) bo‘lishi kerak' })
  address?: string;

  @ApiProperty({
    example: '901234567',
    description: 'Telefon raqami',
  })
  @IsString({ message: 'phone matn (string) bo‘lishi kerak' })
  @IsNotEmpty({ message: 'phone kiritilishi shart' })
  phone: string;

  @ApiPropertyOptional({
    example: 'Rustamov Aziz',
    description: 'Direktor ismi',
  })
  @IsOptional()
  @IsString({ message: 'director_name matn (string) bo‘lishi kerak' })
  director_name?: string;

  @ApiPropertyOptional({
    example: '305277008',
    description: 'INN (STIR)',
  })
  @IsOptional()
  @IsString({ message: 'inn matn (string) bo‘lishi kerak' })
  inn?: string;
}
