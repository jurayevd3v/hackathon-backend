import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class UpdateOfferItemDeliveredQuantityDto {
  @ApiProperty()
  @IsNumber({}, { message: "delivered_quantity raqam bo'lishi kerak" })
  @Min(0, { message: "delivered_quantity 0 dan kichik bo'lmasligi kerak" })
  delivered_quantity: number;
}
