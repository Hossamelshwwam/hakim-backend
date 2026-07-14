import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

const CLOUDINARY_ROOT_FOLDER = 'threadly';

@Injectable()
export class CloudinaryService implements OnModuleInit {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const cloudName = this.config.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get('CLOUDINARY_API_SECRET');

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      this.logger.log('Cloudinary configured');
    } else {
      this.logger.warn(
        'Cloudinary credentials not set — image upload disabled',
      );
    }
  }

  isEnabled(): boolean {
    const c = cloudinary.config();
    return !!(c.cloud_name && c.api_key && c.api_secret);
  }

  uploadFile(buffer: Buffer, folder: string): Promise<UploadApiResponse> {
    if (!this.isEnabled())
      throw new ServiceUnavailableException('Image upload is not configured');

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `${CLOUDINARY_ROOT_FOLDER}/${folder}`,
          resource_type: 'image',
        },
        (err, result) => {
          if (err || !result)
            return reject(new BadRequestException('Upload failed'));
          resolve(result);
        },
      );
      Readable.from(buffer).pipe(stream);
    });
  }

  /**
   * Preferred deletion method. Store `public_id` (from the upload response)
   * on your document alongside the image URL, and pass it here directly.
   * This avoids re-parsing the URL, which breaks on nested folders or
   * transformation segments.
   */
  async deleteFileByPublicId(publicId: string): Promise<void> {
    if (!this.isEnabled()) return;
    await cloudinary.uploader.destroy(publicId);
  }

  /**
   * Fallback for URL-based deletion. Only reliable for single-level
   * subfolders (e.g. `threadly/products/abc123.jpg`). Prefer
   * `deleteFileByPublicId` wherever you control the schema.
   */
  async deleteFile(url: string): Promise<void> {
    if (!this.isEnabled()) return;

    const parts = url.split('/');
    const file = parts[parts.length - 1].split('.')[0];
    const folder = parts[parts.length - 2];

    if (!file || !folder) {
      this.logger.warn(`Could not parse public_id from URL: ${url}`);
      return;
    }

    await cloudinary.uploader.destroy(
      `${CLOUDINARY_ROOT_FOLDER}/${folder}/${file}`,
    );
  }
}
