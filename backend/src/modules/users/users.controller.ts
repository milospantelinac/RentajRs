import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('users')
@Controller()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('users/me')
  getMe(@CurrentUser('id') userId: string) {
    return this.usersService.getMe(userId);
  }

  @Patch('users/me')
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(userId, dto);
  }

  @Post('users/me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  setAvatar(@CurrentUser('id') userId: string, @UploadedFile() file: Express.Multer.File) {
    return this.usersService.setAvatar(userId, file);
  }

  @Get('users/me/favorites')
  listFavorites(@CurrentUser('id') userId: string) {
    return this.usersService.listFavorites(userId);
  }

  @Post('listings/:id/favorite')
  addFavorite(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.usersService.addFavorite(userId, id);
  }

  @Delete('listings/:id/favorite')
  removeFavorite(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.usersService.removeFavorite(userId, id);
  }

  @Get('users/me/export')
  exportData(@CurrentUser('id') userId: string) {
    return this.usersService.exportUserData(userId);
  }

  @Post('users/me/deletion/request')
  requestAccountDeletion(@CurrentUser('id') userId: string) {
    return this.usersService.requestAccountDeletion(userId);
  }

  @Public()
  @Post('users/deletion/confirm')
  confirmAccountDeletion(@Body('token') token: string) {
    return this.usersService.confirmAccountDeletion(token);
  }

  // API paths stay language-neutral English regardless of the pretty,
  // localized URL the frontend renders (e.g. /vlasnik/marko-petrovic per
  // Ch.14.2) — the frontend maps its route param to this endpoint.
  @Public()
  @Get('users/profile/:slug')
  getPublicProfile(@Param('slug') slug: string) {
    return this.usersService.getPublicProfile(slug);
  }
}
