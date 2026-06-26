import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class SelectOfferItemVariantDto {
  @ApiProperty({ example: 'uuid' })
  @IsUUID('4', { message: "variant_id to'g'ri UUID formatda bo'lishi kerak" })
  @IsNotEmpty({ message: "variant_id bo'sh bo'lmasligi kerak" })
  variant_id: string;
}
