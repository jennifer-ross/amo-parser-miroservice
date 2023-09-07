import { Injectable, NotFoundException } from '@nestjs/common'
import { Model, Types } from 'mongoose'
import { User } from '../models/user.schema'
import { InjectModel } from '@nestjs/mongoose'
import { UpdateUserDto } from './dto/update-user.dto'
import { CreateUserDto } from './dto/create-user.dto'

@Injectable()
export class UsersService {
	constructor(
		@InjectModel(User.name)
		private readonly userModel: Model<User>,
	) {}

	async findById(id: Types.ObjectId): Promise<User> {
		return await this.userModel.findById(id).exec()
	}

	async findByLogin(login: string): Promise<User> {
		return await this.userModel.findOne({ login }).exec()
	}

	async createUser(createUserDto: CreateUserDto): Promise<User> {
		const user = new this.userModel(createUserDto)
		return await user.save()
	}

	async updateUser(
		id: Types.ObjectId,
		updateUserDto: UpdateUserDto,
	): Promise<User> {
		const existingUser = await this.userModel.findByIdAndUpdate(
			id,
			updateUserDto,
			{ new: true },
		)

		if (!existingUser) {
			throw new NotFoundException(`User {${id}} not found`)
		}

		return existingUser
	}
}
