import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateLocationActiveDto {
  @ApiProperty({
    example: true,
    description: 'Joylashuvning faollik holati',
  })
  @IsBoolean({ message: 'is_active boolean bo‘lishi kerak' })
  @IsNotEmpty({ message: 'is_active kiritilishi shart' })
  is_active: boolean;
}
