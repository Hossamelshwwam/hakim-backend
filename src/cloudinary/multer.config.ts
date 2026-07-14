import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

export const multerConfig = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new BadRequestException('Only image files are allowed'), false);
  },
};
