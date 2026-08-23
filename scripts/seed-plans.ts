// scripts/seed-plans.ts
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { AppModule } from '../src/app.module';
import { ConfigService } from '@nestjs/config';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const config = app.get(ConfigService);
  const planModel = app.get(getModelToken('Plan'));

  const currency = config.get<string>('PAYMENT_CURRENCY', 'EGP');
  const num = (key: string, fallback: number) => {
    const raw = config.get<string>(key);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const plans = [
    {
      slug: 'basic',
      displayName: 'Basic',
      features: [
        'Up to 5 doctors',
        '1 branch',
        'Appointment scheduling',
        'Patient records',
        'Email support',
      ],
      monthlyPrice: num('BASIC_MONTHLY_PRICE', 1000),
      yearlyPrice: num('BASIC_YEARLY_PRICE', 10000),
      currency,
    },
    {
      slug: 'pro',
      displayName: 'Pro',
      features: [
        'Up to 25 doctors',
        'Up to 3 branches',
        'Appointment scheduling',
        'Patient records',
        'Departments management',
        'Priority email support',
      ],
      monthlyPrice: num('PRO_MONTHLY_PRICE', 2500),
      yearlyPrice: num('PRO_YEARLY_PRICE', 25000),
      currency,
    },
    {
      slug: 'enterprise',
      displayName: 'Enterprise',
      features: [
        'Unlimited doctors',
        'Unlimited branches',
        'Appointment scheduling',
        'Patient records',
        'Departments management',
        'Dedicated account manager',
        '24/7 support',
      ],
      monthlyPrice: num('ENTERPRISE_MONTHLY_PRICE', 6000),
      yearlyPrice: num('ENTERPRISE_YEARLY_PRICE', 60000),
      currency,
    },
  ];

  for (const plan of plans) {
    const existing = await planModel.findOne({ slug: plan.slug });
    if (existing) {
      console.log(`Plan "${plan.slug}" already exists, skipping.`);
      continue;
    }
    await planModel.create(plan);
    console.log(
      `Plan created: ${plan.slug} (${plan.monthlyPrice}/${plan.yearlyPrice} ${currency}/mo-yr)`,
    );
  }

  await app.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
