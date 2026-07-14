import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserDocument } from '../user/schema/user.schema';

@Injectable()
export class TestService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<UserDocument>,
  ) {}
  test() {
    return { message: 'hello from testing' };
  }

  async users() {
    return await this.userModel.find();
  }
}
