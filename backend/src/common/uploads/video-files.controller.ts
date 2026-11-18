import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { Public } from '../decorators/public.decorator';
import { VideoStorageService } from './video-storage.service';

/**
 * The videos an admin uploaded, served from this server's disk at
 * /api/v1/videos/{fileId}.mp4: under the API prefix, so it reaches the browser
 * through the same proxy route as the API with no other change on the server.
 *
 * A player asks for a video in ranges (to start early and to seek), which
 * sendFile answers with 206. The names are random and never reused, so a
 * browser and any cache in front may keep a file for a year. Throttling is
 * off: one viewing is many range requests.
 */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('videos')
export class VideoFilesController {
  constructor(private videos: VideoStorageService) {}

  @Get(':file')
  file(@Param('file') file: string, @Res() res: Response) {
    const full = this.videos.pathOf(file);
    if (!full) throw new NotFoundException();
    // nginx would otherwise copy a long range into a temporary file before passing it on.
    res.set('X-Accel-Buffering', 'no');
    res.sendFile(full, { maxAge: '365d', immutable: true, acceptRanges: true, dotfiles: 'deny' }, (error) => {
      if (!error || res.headersSent) return;
      res.status(404).json({ statusCode: 404, error: 'NotFound', message: 'Not Found' });
    });
  }
}
