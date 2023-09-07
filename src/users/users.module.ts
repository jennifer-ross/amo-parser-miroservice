import { Module } from '@nestjs/common'
import { UsersService } from './users.service'
import { MongooseModule } from '@nestjs/mongoose'
import { User, UserSchema } from '../models/user.schema'

@Module({
	imports: [
		MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
	],
	providers: [UsersService],
})
export class UsersModule {}
