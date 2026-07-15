import { Module } from '@nestjs/common';
import { BranchService } from './branch.service';
import { BranchController } from './branch.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { BranchSchema } from './schema/branch.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Branch', schema: BranchSchema }]),
  ],
  exports: [MongooseModule],
  providers: [BranchService],
  controllers: [BranchController],
})
export class BranchModule {}
