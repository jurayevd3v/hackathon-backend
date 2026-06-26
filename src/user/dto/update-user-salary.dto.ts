import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class UpdateUserSalaryDto {
  @ApiProperty({ example: 1000000 })
  @IsNumber({}, { message: 'Salary son bo`lishi kerak' })
  @Min(0, { message: 'Salary 0 dan katta bo`lishi kerak' })
  @IsNotEmpty({ message: 'Salary bo`sh bo`lmasligi kerak' })
  salary: number;
}
