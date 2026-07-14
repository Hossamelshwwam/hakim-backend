import { Injectable } from '@nestjs/common';

@Injectable()
export class SlugService {
  slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  uniqueSlug(base: string, suffix?: string): string {
    return suffix ? `${this.slugify(base)}-${suffix}` : this.slugify(base);
  }
}
