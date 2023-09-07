import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import configuration from './config/configuration'
import {
	FastifyAdapter,
	NestFastifyApplication,
} from '@nestjs/platform-fastify'
import compression from '@fastify/compress'

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

bootstrap()
