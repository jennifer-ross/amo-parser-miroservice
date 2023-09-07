import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common'
import { AuthService } from './auth.service'
import { AuthDto } from './dto/auth.dto'
import { FastifyRequest } from 'fastify'
import { JwtRefreshAuthGuard } from './jwtRefreshAuth.guard'

@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post()
	async auth(@Body() authDto: AuthDto) {
		return await this.authService.signIn(authDto)
	}

	@UseGuards(JwtRefreshAuthGuard)
	@Post('/refresh')
	async refresh(@Request() request) {
		return await this.authService.refreshTokens(
			request.user._id,
			request.user.refreshToken,
		)
	}
}
