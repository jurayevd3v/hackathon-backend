import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LocationType } from '../../common/enums/location-type.enum';

export class UpdateLocationDto {
  @ApiPropertyOptional({
    enum: LocationType,
    example: LocationType.COMPANY,
    description: 'Joylashuv turi',
  })
  @IsOptional()
  @IsEnum(LocationType, { message: 'type noto‘g‘ri kiritilgan' })
  type?: LocationType;

  @ApiPropertyOptional({
    example: 'Tezkor Qurilish MCHJ',
    description: 'Nomi',
  })
  @IsOptional()
  @IsString({ message: 'name matn (string) bo‘lishi kerak' })
  name?: string;

  @ApiPropertyOptional({
    example: 'Andijon viloyati, Andijon shahri',
    description: 'Manzil',
  })
  @IsOptional()
  @IsString({ message: 'address matn (string) bo‘lishi kerak' })
  address?: string;

  @ApiPropertyOptional({
    example: '901234567',
    description: 'Telefon raqami',
  })
  @IsOptional()
  @IsString({ message: 'phone matn (string) bo‘lishi kerak' })
  phone?: string;

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
