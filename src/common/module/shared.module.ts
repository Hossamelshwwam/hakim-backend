import { Global, Module } from '@nestjs/common';
import { PaginationService } from '../services/pagination.service';
import { SlugService } from '../services/slug.service';

@Global()
@Module({
  providers: [SlugService, PaginationService],
  exports: [SlugService, PaginationService],
})
export class SharedModule {}
