import { Strategy } from 'passport-local'
import { PassportStrategy } from '@nestjs/passport'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service'
import { User } from '../models/user.schema'

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly authService: AuthService) {
        super()
    }

    async validate(password: string): Promise<any> {
        // const validatedUser = await this.authService.validateUser(
        //     user,
        //     password,
        // )

        const user = null
        if (!user) {
            throw new UnauthorizedException()
        }
        return user
    }
}
