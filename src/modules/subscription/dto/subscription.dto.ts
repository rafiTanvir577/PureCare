import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateSubscriptionSessionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  priceId: string;

  @ApiProperty({ default: 1 })
  @Type(() => Number)
  @Min(1)
  @IsNumber()
  quantity: number;
}
