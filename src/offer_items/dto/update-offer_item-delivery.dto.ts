import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { DeliveryType } from '../../common/enums/delivery-type.enum';

export class UpdateOfferItemDeliveryDto {
  @ApiProperty()
  @IsBoolean({ message: "is_delivery boolean bo'lishi kerak" })
  is_delivery: boolean;

  @ApiPropertyOptional({ enum: DeliveryType })
  @IsEnum(DeliveryType, {
    message: `delivery_type quyidagilardan biri bo'lishi kerak: ${Object.values(DeliveryType).join(', ')}`,
  })
  @IsOptional()
  delivery_type?: DeliveryType;

  @ApiPropertyOptional()
  @IsNumber({}, { message: "delivery_sum raqam bo'lishi kerak" })
  @Min(0, { message: "delivery_sum 0 dan kichik bo'lmasligi kerak" })
  @IsOptional()
  delivery_sum?: number;
}
