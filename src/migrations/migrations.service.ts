import { Injectable, Logger } from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import { Connection } from 'mongoose'
import { UsersMigration } from './usersMigration'

@Injectable()
export class MigrationsService {
    usersMigration: UsersMigration
    private readonly logger = new Logger(MigrationsService.name)

    constructor(@InjectConnection() private readonly connection: Connection) {
        this.usersMigration = new UsersMigration()
    }

    async runMigrationsUp(): Promise<any> {
        this.logger.log('Running all migrations up...')

        await this.usersMigration.up(
            this.connection.db,
            this.connection.getClient(),
        )

        this.logger.log('All migrations completed successfully')
    }
}
