import { Module } from '@nestjs/common'
import { MessageService } from './message.service'
import { MessageController } from './message.controller'
import { PuppeteerService } from '../puppeteer/puppeteer.service'
import { WorkerPool } from '../worker.pool'

@Module({
	controllers: [MessageController],
	providers: [MessageService, PuppeteerService, WorkerPool],
})
export class MessageModule {}
