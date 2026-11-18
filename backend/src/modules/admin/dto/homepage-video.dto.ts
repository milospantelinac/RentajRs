import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { HOMEPAGE_VIDEO_SOURCES, HomepageVideoSource } from '../../../common/utils/homepage-video';

export class StartVideoUploadDto {
  @ApiProperty({ description: 'The name of the file on the admin computer, kept to show it' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ description: 'Bytes; no limit beyond the free space on the server' })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  size: number;

  @ApiPropertyOptional({ description: "The file's modification time (File.lastModified), so the same file picked again carries on" })
  @IsOptional()
  @IsInt()
  @Min(0)
  lastModified?: number;
}

export class HomepageVideoSourceDto {
  @ApiProperty({ enum: HOMEPAGE_VIDEO_SOURCES, description: 'What the homepage shows when there are both a link and an uploaded video' })
  @IsIn(HOMEPAGE_VIDEO_SOURCES)
  source: HomepageVideoSource;
}
