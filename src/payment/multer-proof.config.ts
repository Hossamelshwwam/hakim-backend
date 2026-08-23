import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

// Payment proofs may be screenshots or bank-statement PDFs
export const proofMulterConfig = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(
    _req: unknown,
    file: { mimetype: string },
    cb: (err: Error | null, accept: boolean) => void,
  ) {
    const allowed = /^(image\/(jpeg|png|webp)|application\/pdf)$/;
    if (allowed.test(file.mimetype)) cb(null, true);
    else
      cb(
        new BadRequestException('Only images or PDF files are allowed'),
        false,
      );
  },
};
