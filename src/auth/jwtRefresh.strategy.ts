import { Strategy, ExtractJwt } from 'passport-jwt'
import { PassportStrategy } from '@nestjs/passport'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service'
import configuration from '../config/configuration'
import { FastifyRequest } from 'fastify'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
	Strategy,
	'jwt-refresh',
) {
	constructor(private readonly configService: ConfigService) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: configService.get('jwt.refreshPrivateKey'),
			passReqToCallback: true,
		})
	}

	async validate(req: FastifyRequest, payload: any): Promise<any> {
		if (!payload) {
			throw new UnauthorizedException()
		}

		const refreshToken = req.headers['authorization']
			.replace('Bearer', '')
			.trim()

		return { ...payload, refreshToken }
	}
}
