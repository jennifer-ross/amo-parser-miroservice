import { isBoolean, toLower, parseInt } from 'lodash'
import { EncodingToken } from '../types/compression'
import * as process from 'process'
import * as fs from 'fs'
import * as path from 'path'
import { Algorithm } from 'jsonwebtoken'

export default () => ({
	isDev: process.env.NODE_ENV !== 'production' || 'production',
	port: parseInt(process.env.PORT, 10) || 3000,
	logs:
		isBoolean(toLower(process.env.LOGS)) &&
		toLower(process.env.LOGS) === 'true',
	host: process.env.HOST || '127.0.0.1',
	compressionEncodings: ['gzip', 'deflate'] as EncodingToken[],
	saltRounds: parseInt(process.env.SALT_ROUNDS, 10) || 10,
	jwt: {
		algorithm: 'RS256' as Algorithm,
		issuer: process.env.JWT_ISSUER || '127.0.0.1',
		audience: process.env.JWT_AUDIENCE || '127.0.0.1',
		refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
		accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15d',
		accessPrivateKey:
			fs.readFileSync(
				path.join(process.cwd(), 'src/keys/jwtRS256.key'),
				'utf8',
			) || '',
		accessPublicKey:
			fs.readFileSync(
				path.join(process.cwd(), 'src/keys/jwtRS256.key.pub'),
				'utf8',
			) || '',
		refreshPrivateKey:
			fs.readFileSync(
				path.join(process.cwd(), 'src/keys/jwtRefreshRS256.key'),
				'utf8',
			) || '',
		refreshPublicKey:
			fs.readFileSync(
				path.join(process.cwd(), 'src/keys/jwtRefreshRS256.key.pub'),
				'utf8',
			) || '',
	},
	database: {
		name: process.env.DB_NAME || 'parser',
		uri: process.env.DB_HOST || 'localhost:27017',
		password: process.env.DB_PASSWORD || 'root',
		username: process.env.DB_USERNAME || 'root',
	},
	throttleTtl: parseInt(process.env.THROTTLE_TTL, 10) || 60,
	throttleLimit: parseInt(process.env.THROTTLE_LIMIT, 10) || 10,
})