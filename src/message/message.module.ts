import { Module } from '@nestjs/common'
import { MessageService } from './message.service'
import { MessageController } from './message.controller'
import { PuppeteerService } from '../puppeteer/puppeteer.service'
import { WorkerPool } from '../worker.pool'
import { HttpModule, HttpService } from '@nestjs/axios'
import { QueueService } from '../queue/queue.service'

@Module({
	imports: [HttpModule],
	controllers: [MessageController],
	providers: [MessageService, PuppeteerService, WorkerPool, QueueService],
})
export class MessageModule {}
