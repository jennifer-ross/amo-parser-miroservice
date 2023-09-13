import { Injectable } from '@nestjs/common'
import { PuppeteerService } from '../puppeteer/puppeteer.service'
import { QueueService } from '../queue/queue.service'
import { SendMessageType } from '../types/message'

@Injectable()
export class LeadsService {
	constructor(
		private readonly puppeteerService: PuppeteerService,
		private readonly queueService: QueueService,
	) {}

	async getLead(leadId: string) {
		return this.queueService.createJob(async () => {
			return await this.puppeteerService.getLead(leadId)
		})
	}

	async getLeadSources(leadId: string) {
		return this.queueService.createJob(async () => {
			return await this.puppeteerService.getLeadSources(leadId)
		})
	}
}
