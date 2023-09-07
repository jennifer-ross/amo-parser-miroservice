import { BadRequestException, Injectable } from '@nestjs/common'
import { UsersService } from '../users/users.service'
import { JwtService } from '@nestjs/jwt'
import { WorkerPool } from '../worker.pool'
import configuration from '../config/configuration'
import { User } from '../models/user.schema'
import { AuthDto } from './dto/auth.dto'
import { ConfigService } from '@nestjs/config'
import { Types } from 'mongoose'
import { use } from 'passport'

@Injectable()
export class AuthService {
	constructor(
		private readonly usersService: UsersService,
		private readonly jwtService: JwtService,
		private readonly workerPool: WorkerPool,
		private readonly configService: ConfigService,
	) {}

	async signIn(authDto: AuthDto) {
		const user = await this.usersService.findByLogin(authDto.login)

		if (!user) {
			throw new BadRequestException('User does not exist')
		}

		if (!(await this.validateUser(user, authDto.password))) {
			throw new BadRequestException('Password is incorrect')
		}

		const tokens = await this.getTokens(user)
		const updatedUser = await this.updateUser(user, tokens.refreshToken)

		if (!updatedUser) {
			throw new BadRequestException('Cannot update user')
		}

		return tokens
	}

	async refreshTokens(userId: string, refreshToken: string) {
		const user = await this.usersService.findById(
			new Types.ObjectId(userId),
		)

		if (!user) {
			throw new BadRequestException('User does not exist')
		}

		if (user.refreshToken !== refreshToken) {
			throw new BadRequestException('Refresh token is not valid')
		}

		const tokens = await this.getTokens(user)
		const updatedUser = await this.updateUser(user, tokens.refreshToken)

		if (!updatedUser) {
			throw new BadRequestException('Cannot update user')
		}

		return tokens
	}

	async updateUser(user: User, refreshToken: string): Promise<User> {
		return await this.usersService.updateUser(user._id, {
			updatedAt: new Date(),
			refreshToken: refreshToken,
		})
	}

	async getTokens(
		user: User,
	): Promise<{ accessToken: string; refreshToken: string }> {
		const payload = {
			_id: user._id.toString(),
			login: user.login,
		}

		return {
			accessToken: await this.jwtService.signAsync(payload, {
				algorithm: this.configService.get('jwt.algorithm'),
				issuer: this.configService.get('jwt.issuer'),
				audience: this.configService.get('jwt.audience'),
				expiresIn: this.configService.get('jwt.accessExpiresIn'),
				privateKey: this.configService.get('jwt.accessPrivateKey'),
				jwtid: await this.workerPool.generateStringUtf8(32),
				subject: user._id.toString(),
			}),
			refreshToken: await this.jwtService.signAsync(payload, {
				algorithm: this.configService.get('jwt.algorithm'),
				issuer: this.configService.get('jwt.issuer'),
				audience: this.configService.get('jwt.audience'),
				expiresIn: this.configService.get('jwt.refreshExpiresIn'),
				privateKey: this.configService.get('jwt.refreshPrivateKey'),
				jwtid: await this.workerPool.generateStringUtf8(32),
				subject: user._id.toString(),
			}),
		}
	}

	async validateUser(user: User, password: string): Promise<boolean> {
		return await this.workerPool.comparePassword(password, user.password)
	}
}
