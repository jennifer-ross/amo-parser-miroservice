import { Module } from '@nestjs/common'
import { LeadsController } from './leads.controller'
import { LeadsService } from './leads.service'
import { PuppeteerService } from '../puppeteer/puppeteer.service'
import { WorkerPool } from '../worker.pool'

@Module({
	controllers: [LeadsController],
	providers: [LeadsService, PuppeteerService, WorkerPool],
})
export class LeadsModule {}
