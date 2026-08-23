import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentService } from './payment.service';

@Injectable()
export class PaymentCronService {
  private readonly logger = new Logger(PaymentCronService.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly configService: ConfigService,
  ) {}

  private get invoiceLeadDays() {
    return this.configService.get<number>('INVOICE_LEAD_DAYS', 7);
  }

  private get graceDays() {
    return this.configService.get<number>('PAYMENT_GRACE_DAYS', 7);
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleDailyBillingCycle() {
    try {
      const overdue = await this.paymentService.markOverdue();
      if (overdue.modified > 0)
        this.logger.log(`Marked ${overdue.modified} payments as overdue`);

      const invoices = await this.paymentService.generateUpcomingInvoices(
        this.invoiceLeadDays,
      );
      if (invoices.created > 0)
        this.logger.log(`Generated ${invoices.created} upcoming invoices`);

      const suspended = await this.paymentService.suspendExpiredHospitals(
        this.graceDays,
      );
      if (suspended.suspended > 0)
        this.logger.warn(
          `Suspended ${suspended.suspended} hospitals for non-payment`,
        );
    } catch (err) {
      this.logger.error(
        'Daily billing cycle failed',
        err instanceof Error ? err.stack : err,
      );
    }
  }
}
