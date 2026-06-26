import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class UpdateOfferPaidSumDto {
  @ApiProperty()
  @IsNumber({}, { message: "paid_sum raqam bo'lishi kerak" })
  @Min(0, { message: "paid_sum 0 dan kichik bo'lmasligi kerak" })
  paid_sum: number;
}
