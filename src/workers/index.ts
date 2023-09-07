import * as wp from 'workerpool'
import { hashPassword, comparePassword } from './password'
import { generateStringUtf8, generateStringHex } from './string'

wp.worker({
	hashPassword: hashPassword,
	comparePassword: comparePassword,
	generateStringHex: generateStringHex,
	generateStringUtf8: generateStringUtf8,
})
