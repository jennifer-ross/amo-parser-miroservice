import { Module } from '@nestjs/common'
import { LeadsController } from './leads.controller'
import { LeadsService } from './leads.service'
import { PuppeteerService } from '../puppeteer/puppeteer.service'
import { WorkerPool } from '../worker.pool'
import { QueueService } from '../queue/queue.service'
import { HttpModule, HttpService } from '@nestjs/axios'

@Module({
	imports: [HttpModule],
	controllers: [LeadsController],
	providers: [LeadsService, PuppeteerService, WorkerPool, QueueService],
})
export class LeadsModule {}
