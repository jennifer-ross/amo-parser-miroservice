import { MigrationInterface } from 'mongo-migrate-ts'
import { Db, MongoClient } from 'mongodb'
import { User } from '../models/user.schema'
import { hashPassword } from '../workers/password'
import configuration from '../config/configuration'

export class UsersMigration implements MigrationInterface {
	async up(db: Db, client: MongoClient): Promise<any> {
		const session = client.startSession()
		try {
			await session.withTransaction(async () => {
				const collection = (await db.listCollections().toArray()).find(
					(p) => p.name === User.name,
				)

				if (!collection) {
					await db.createCollection(User.name)
				}

				const users = await db.collection<User>(User.name).find()

				if ((await users.toArray()).length === 0) {
					await db.collection<User>(User.name).insertOne({
						login: configuration().defaultUser,
						password: await hashPassword(
							configuration().defaultPassword,
						),
						createdAt: new Date(),
						updatedAt: new Date(),
						refreshToken: '',
						_id: null,
					})
				}
			})
		} finally {
			await session.endSession()
		}
	}

	async down(db: Db, client: MongoClient): Promise<any> {
		const session = client.startSession()
		try {
			await db.dropCollection(User.name)
		} finally {
			await session.endSession()
		}
	}
}
