import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

/** Korak 1 — category is mandatory and always the first step (R19). */
export class CreateListingDto {
  @ApiProperty()
  @IsUUID('4')
  @IsNotEmpty()
  categoryId: string;
}
