import { IsDate, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateUserDto {
	@IsNotEmpty()
	@IsString()
	login: string

	@IsNotEmpty()
	@IsString()
	password: string

	@IsNotEmpty()
	@IsDate()
	createdAt: Date

	@IsOptional()
	@IsDate()
	updatedAt?: Date

	@IsOptional()
	refreshToken?: string
}
