import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScheduleService } from './schedule.service';

@Injectable()
export class ScheduleCronService {
  private readonly logger = new Logger(ScheduleCronService.name);

  constructor(private readonly scheduleService: ScheduleService) {}

  // Runs after the payment cron (01:00) — keeps the 8-week booking window full
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async extendBookingHorizons() {
    try {
      const result = await this.scheduleService.extendHorizons();
      if (result.created > 0)
        this.logger.log(
          `Materialized ${result.created} new slot occurrences across ${result.templates} templates`,
        );
    } catch (err) {
      this.logger.error(
        'Slot horizon extension failed',
        err instanceof Error ? err.stack : err,
      );
    }
  }
}
