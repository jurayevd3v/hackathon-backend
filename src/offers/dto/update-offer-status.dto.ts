import { IsEnum, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OfferStatus } from '../../common/enums/offer-status.enum';

export class UpdateOfferStatusDto {
  @ApiProperty({
    enum: OfferStatus,
    example: OfferStatus.IN_PROGRESS,
    description: 'Offer status holati',
  })
  @IsEnum(OfferStatus, {
    message:
      'Status noto‘g‘ri qiymat. Ruxsat etilgan qiymatlar: new, in_progress, contract_signed, paid, completed, cancelled',
  })
  status: OfferStatus;

  @ApiPropertyOptional({
    example: 'CN-2026-001',
    description: 'Shartnoma raqami',
  })
  @IsOptional()
  @IsString({
    message: 'Contract number matn bo‘lishi kerak',
  })
  @IsNotEmpty({
    message: 'Contract number bo‘sh bo‘lmasligi kerak',
  })
  contract_number?: string;
}
