import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateLocationContactedDto {
  @ApiProperty({
    example: true,
    description: 'Aloqa qilinganlik holati',
  })
  @IsBoolean({ message: 'is_contacted boolean bo‘lishi kerak' })
  @IsNotEmpty({ message: 'is_contacted kiritilishi shart' })
  is_contacted: boolean;
}
