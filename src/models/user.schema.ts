import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { model, Types } from 'mongoose'

@Schema({ collection: User.name })
export class User {
	_id: Types.ObjectId

	@Prop({ unique: true })
	login: string

	@Prop()
	password: string

	@Prop({ default: new Date() })
	createdAt: Date

	@Prop({ default: null })
	updatedAt: Date

	@Prop()
	refreshToken: string
}

export type UserDocument = User & Document

export const UserSchema = SchemaFactory.createForClass(User)

export const UserModel = model<User>(User.name, UserSchema, User.name)
