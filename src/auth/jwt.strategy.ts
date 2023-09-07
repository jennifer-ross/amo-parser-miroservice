import { Strategy, ExtractJwt } from 'passport-jwt'
import { PassportStrategy } from '@nestjs/passport'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service'
import configuration from '../config/configuration'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(private authService: AuthService) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: configuration().jwt.accessPrivateKey,
		})
	}

	async validate(payload: any): Promise<any> {
		if (!payload) {
			throw new UnauthorizedException()
		}
		return payload
	}
}
