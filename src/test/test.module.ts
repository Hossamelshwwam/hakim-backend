import { Module } from '@nestjs/common';
import { TestController } from './test.controller';
import { TestService } from './test.service';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema } from '../user/schema/user.schema';

@Module({
  controllers: [TestController],
  providers: [TestService],
  imports: [MongooseModule.forFeature([{ name: 'User', schema: UserSchema }])],
})
export class TestModule {}
