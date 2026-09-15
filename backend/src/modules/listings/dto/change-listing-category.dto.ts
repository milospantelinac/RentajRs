import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

/** Dizajn 19: "Promeni kategoriju" in the wizard moves a draft to another category. */
export class ChangeListingCategoryDto {
  @ApiProperty()
  @IsUUID('4')
  @IsNotEmpty()
  categoryId: string;
}
