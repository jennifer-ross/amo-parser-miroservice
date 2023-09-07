import * as bcrypt from 'bcrypt'
import configuration from '../config/configuration'

export const hashPassword = async (password: string): Promise<string> => {
	const salt = await bcrypt.genSalt(configuration().saltRounds)
	return await bcrypt.hash(password, salt)
}

export const comparePassword = async (params: {
	password: string
	encrypted: string
}): Promise<boolean> => {
	return await bcrypt.compare(params.password, params.encrypted)
}
