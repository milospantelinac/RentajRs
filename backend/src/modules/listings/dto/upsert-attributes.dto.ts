import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsUUID, ValidateNested } from 'class-validator';

class AttributeValueInput {
  @ApiProperty()
  @IsUUID('4')
  attributeId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  valueNumber?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  valueText?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  valueBoolean?: boolean;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  valueOptionIds?: string[];
}

/** Korak 4 — one full replace of the category's attribute values is simpler than N per-field PATCHes. */
export class UpsertAttributesDto {
  @ApiProperty({ type: [AttributeValueInput] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AttributeValueInput)
  values: AttributeValueInput[];
}
