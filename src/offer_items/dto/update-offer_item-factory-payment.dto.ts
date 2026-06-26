import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class UpdateOfferItemFactoryPaymentDto {
  @ApiProperty()
  @IsNumber({}, { message: "factory_paid_sum raqam bo'lishi kerak" })
  @Min(0, { message: "factory_paid_sum 0 dan kichik bo'lmasligi kerak" })
  paid_sum: number;
}
