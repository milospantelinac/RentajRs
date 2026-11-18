import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { HomepageVideoService } from './homepage-video.service';
import { HomepageVideoSourceDto, StartVideoUploadDto } from './dto/homepage-video.dto';

/**
 * The homepage video in Administracija > Sadržaj. An upload is opened with
 * POST /uploads, sent in parts with PUT /uploads/:id?offset=N (the bytes as
 * application/octet-stream, read straight to the disk) and finished with
 * POST /uploads/:id/complete. Not throttled: a large video is hundreds of
 * parts, and only an admin reaches these.
 */
@ApiTags('admin')
@RequirePermissions('manage_settings')
@SkipThrottle()
@Controller('admin/homepage-video')
export class HomepageVideoController {
  constructor(private homepageVideo: HomepageVideoService) {}

  @Get()
  state() {
    return this.homepageVideo.state();
  }

  @Patch('source')
  setSource(@CurrentUser('id') adminId: string, @Body() dto: HomepageVideoSourceDto) {
    return this.homepageVideo.setSource(adminId, dto.source);
  }

  @Delete('upload')
  removeUpload(@CurrentUser('id') adminId: string) {
    return this.homepageVideo.removeUpload(adminId);
  }

  @Post('uploads')
  startUpload(@CurrentUser('id') adminId: string, @Body() dto: StartVideoUploadDto) {
    return this.homepageVideo.startUpload(adminId, dto);
  }

  @Get('uploads/:id')
  uploadStatus(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.homepageVideo.uploadStatus(adminId, id);
  }

  @Put('uploads/:id')
  @ApiConsumes('application/octet-stream')
  writeChunk(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('offset', ParseIntPipe) offset: number,
    @Req() req: Request,
  ) {
    const length = Number(req.headers['content-length']);
    return this.homepageVideo.writeChunk(adminId, id, offset, req, Number.isFinite(length) ? length : undefined);
  }

  @Post('uploads/:id/complete')
  @HttpCode(200)
  completeUpload(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.homepageVideo.completeUpload(adminId, id);
  }

  @Delete('uploads/:id')
  cancelUpload(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.homepageVideo.cancelUpload(adminId, id);
  }
}
