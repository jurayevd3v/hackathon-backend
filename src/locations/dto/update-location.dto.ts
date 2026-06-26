import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
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

  @ApiPropertyOptional({
    example: 40.7821,
    description: 'Kenglik (latitude)',
  })
  @IsOptional()
  @IsLatitude({ message: 'lat noto‘g‘ri formatda' })
  lat?: number;

  @ApiPropertyOptional({
    example: 72.3442,
    description: 'Uzunlik (longitude)',
  })
  @IsOptional()
  @IsLongitude({ message: 'lng noto‘g‘ri formatda' })
  lng?: number;

  @ApiPropertyOptional({
    example: 'b1e2a3c4-...',
    description: 'Mas’ul foydalanuvchi ID',
  })
  @IsOptional()
  @IsUUID('4', { message: 'assignee_id noto‘g‘ri UUID formatda' })
  assignee_id?: string;

  @ApiPropertyOptional({
    example: 'c4b3a2e1-...',
    description: 'Ota joylashuv ID (filial bo‘lsa)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'parent_id noto‘g‘ri UUID formatda' })
  parent_id?: string;
}
