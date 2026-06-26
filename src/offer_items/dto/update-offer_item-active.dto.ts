import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsBoolean } from 'class-validator';

export class UpdateOfferItemActiveDto {
  @ApiProperty({
    type: 'boolean',
    example: false,
    description: 'Holati',
  })
  @IsBoolean()
  @IsNotEmpty()
  is_active: boolean;
}
