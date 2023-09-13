import dotenv from 'dotenv'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import configuration from './config/configuration'
import {
	FastifyAdapter,
	NestFastifyApplication,
} from '@nestjs/platform-fastify'
import compression from '@fastify/compress'
import * as path from 'path'
import * as process from 'process'
import { AppClusterService } from './app-cluster/app-cluster.service'

dotenv.config({
	path: path.join(process.cwd(), 'src/.env'),
})

async function bootstrap() {
	const app = await NestFactory.create<NestFastifyApplication>(
		AppModule,
		new FastifyAdapter({
			logger: configuration().logs,
		}),
		{
			rawBody: true,
		},
	)

	await app.setGlobalPrefix('api')
	await app.register(compression, {
		encodings: configuration().compressionEncodings,
	})
	await app.enableCors({
		origin: '*',
		methods: 'GET,HEAD,PUT,PATCH,POST',
		credentials: true,
	})

	await app.listen(configuration().port, configuration().host)
}

try {
	AppClusterService.clusterize(bootstrap)
} catch (e) {
	console.error((e as Error).message)
}
