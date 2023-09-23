import { Injectable } from '@nestjs/common'
import { PuppeteerService } from '../puppeteer/puppeteer.service'
import { QueueService } from '../queue/queue.service'
import { WorkerPool } from '../worker.pool'

@Injectable()
export class LeadsService {
	constructor(
		private readonly puppeteerService: PuppeteerService,
		private readonly queueService: QueueService,
		private readonly workerPool: WorkerPool,
	) {}

	async getLead(leadId: string) {
		const taskId = await this.workerPool.generateStringUtf8(10)
		return this.queueService.createJob(async () => {
			return await this.puppeteerService.getLead(leadId, taskId)
		}, taskId)
	}

	async getLeadSources(leadId: string) {
		const taskId = await this.workerPool.generateStringUtf8(10)
		return this.queueService.createJob(async () => {
			return await this.puppeteerService.getLeadSources(leadId, taskId)
		}, taskId)
	}
}
