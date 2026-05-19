import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/types/request-user.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

type UploadFolder = 'avatars' | 'logos' | 'clinic-assets' | 'payment-proofs';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
    @Query('folder') folder: string = 'clinic-assets',
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const allowedFolders: UploadFolder[] = ['avatars', 'logos', 'clinic-assets', 'payment-proofs'];
    const uploadFolder: UploadFolder = allowedFolders.includes(folder as UploadFolder)
      ? (folder as UploadFolder)
      : 'clinic-assets';

    const url = await this.uploadService.uploadImage(
      file.buffer,
      file.mimetype,
      uploadFolder,
      user.userId,
    );

    return { url };
  }

  @Public()
  @Post('payment-proof')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadPaymentProof(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const url = await this.uploadService.uploadImage(
      file.buffer,
      file.mimetype,
      'payment-proofs',
      'public-renewal',
    );

    return { url };
  }
}
