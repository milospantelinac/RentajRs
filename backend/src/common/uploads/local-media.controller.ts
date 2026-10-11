import { Controller, ForbiddenException, Get, NotFoundException, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Public } from '../decorators/public.decorator';
import { StorageService } from './storage.service';
import { isAttachmentKey } from './media';
import { isProbeKey } from './storage-probe';

/**
 * T143: on a developer's machine (the local storage driver) this opens a
 * private file from a signed link, as the private bucket does on the server.
 * The link is the permission: it is only made for the two sides of the
 * conversation, and it runs out. On the server there is nothing here.
 */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('media-private')
export class LocalMediaController {
  constructor(private storage: StorageService) {}

  @Get('*')
  async file(
    @Req() req: Request,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res() res: Response,
  ) {
    const driver = this.storage.localDriver;
    const key = req.params[0];
    // Attachments, and the test file of the storage check (storage-probe.ts).
    if (!driver || !(isAttachmentKey(key) || isProbeKey(key))) throw new NotFoundException();
    const opened = await driver.openSigned(key, expires, signature);
    // A bucket answers a wrong or expired link with 403 as well.
    if (!opened) throw new ForbiddenException();
    res.type(opened.contentType);
    if (opened.contentDisposition) res.set('Content-Disposition', opened.contentDisposition);
    res.set('Cache-Control', 'private, max-age=3600');
    return res.sendFile(opened.file);
  }
}
