// scripts/seed-platform-admin.ts
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { ConfigService } from '@nestjs/config';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const config = app.get(ConfigService);
  const adminModel = app.get(getModelToken('PlatformAdmin'));

  const email = config.getOrThrow<string>('SEED_ADMIN_EMAIL');
  const password = config.getOrThrow<string>('SEED_ADMIN_PASSWORD');
  const name = config.get<string>('SEED_ADMIN_NAME', 'Platform Admin');

  const existing = await adminModel.findOne({ email });
  if (existing) {
    console.log('Platform admin already exists, skipping.');
    await app.close();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await adminModel.create({ name, email, passwordHash });

  console.log(`Platform admin created: ${email}`);
  await app.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
