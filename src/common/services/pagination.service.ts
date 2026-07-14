import { Injectable } from '@nestjs/common';
import { PaginationMeta } from '../types/pagination.type';

@Injectable()
export class PaginationService {
  getPagination = (page = 1, limit = 20) => {
    const safePage = Math.max(1, Number(page));
    const safeLimit = Math.min(100, Math.max(1, Number(limit)));
    return {
      skip: (safePage - 1) * safeLimit,
      limit: safeLimit,
      page: safePage,
    };
  };

  buildPaginationMeta = (
    total: number,
    page: number,
    limit: number,
  ): PaginationMeta => ({
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
}
