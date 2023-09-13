import { Logger, Module } from '@nestjs/common'
import { AppService } from './app.service'
import { AuthModule } from './auth/auth.module'
import { ConfigModule, ConfigService } from '@nestjs/config'
import configuration from './config/configuration'
import { WorkerPool } from './worker.pool'
import { UsersModule } from './users/users.module'
import { ThrottlerModule } from '@nestjs/throttler'
import { DevtoolsModule } from '@nestjs/devtools-integration'
import { MongooseModule } from '@nestjs/mongoose'
import { MigrationsService } from './migrations/migrations.service'
import { PuppeteerService } from './puppeteer/puppeteer.service'
import { LeadsModule } from './leads/leads.module'
import { MessageModule } from './message/message.module'
import { QueueService } from './queue/queue.service'
import { HttpModule, HttpService } from '@nestjs/axios'
import { AppClusterService } from './app-cluster/app-cluster.service';

@Module({
	imports: [
		// DevtoolsModule.register({
		// 	http: process.env.NODE_ENV !== 'production',
		// }),
		ConfigModule.forRoot({
			load: [configuration],
			isGlobal: true,
			envFilePath: '.env',
			ignoreEnvFile: false,
		}),
		ThrottlerModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				throttlers: [
					{
						name: 'GlobalThrottler',
						ttl: config.get<number>('throttleTtl'),
						limit: config.get<number>('throttleLimit'),
					},
				],
			}),
		}),
		MongooseModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				uri: `mongodb://${config.get<string>('database.uri')}`,
				dbName: config.get<string>('database.name'),
				auth: {
					password: config.get<string>('database.password'),
					username: config.get<string>('database.username'),
				},
				authSource: config.get<string>('database.name'),
				authMechanism: 'DEFAULT',
			}),
		}),
		AuthModule,
		UsersModule,
		LeadsModule,
		MessageModule,
		HttpModule,
	],
	controllers: [],
	providers: [
		AppService,
		WorkerPool,
		MigrationsService,
		PuppeteerService,
		QueueService,
		AppClusterService,
	],
})
export class AppModule {
	private readonly logger = new Logger(AppModule.name)
	constructor(private migrationService: MigrationsService) {}

	async onModuleInit() {
		await this.migrationService.runMigrationsUp()
	}
}
