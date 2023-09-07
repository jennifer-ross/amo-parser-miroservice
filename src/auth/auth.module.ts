import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { WorkerPool } from '../worker.pool'
import { UsersService } from '../users/users.service'
import configuration from '../config/configuration'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { User, UserSchema } from '../models/user.schema'
import { MongooseModule } from '@nestjs/mongoose'
import { ConfigService } from '@nestjs/config'
import { JwtStrategy } from './jwt.strategy'
import { JwtRefreshStrategy } from './jwtRefresh.strategy'
import { LocalStrategy } from './local.strategy'

@Module({
	imports: [
		PassportModule.register({
			session: false,
		}),
		MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
		JwtModule.register({
			global: true,
			signOptions: { expiresIn: configuration().jwt.accessExpiresIn },
			privateKey: configuration().jwt.accessPrivateKey,
		}),
	],
	controllers: [AuthController],
	providers: [
		AuthService,
		WorkerPool,
		UsersService,
		ConfigService,
		JwtStrategy,
		JwtRefreshStrategy,
		LocalStrategy,
	],
})
export class AuthModule {}
