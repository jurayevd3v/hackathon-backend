import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OfferItemStatus } from '../../common/enums/offer-item-status.enum';

export class UpdateOfferItemStatusDto {
  @ApiProperty({
    enum: OfferItemStatus,
    example: OfferItemStatus.ON_THE_WAY,
    description: 'Buyurtma elementi holati',
  })
  @IsEnum(OfferItemStatus)
  @IsNotEmpty()
  status: OfferItemStatus;

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
