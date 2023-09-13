import { Injectable } from '@nestjs/common'
import { PuppeteerService } from '../puppeteer/puppeteer.service'
import { QueueService } from '../queue/queue.service'
import { SendMessageType } from '../types/message'

@Injectable()
export class MessageService {
	constructor(
		private readonly puppeteerService: PuppeteerService,
		private readonly queueService: QueueService,
	) {}

	async sendMessage(
		leadId: string,
		message: string,
		messageType: SendMessageType,
		chatId?: string,
	) {
		return this.queueService.createJob(async () => {
			return await this.puppeteerService.sendMessage(
				leadId,
				message,
				messageType,
				chatId,
			)
		})
	}
}
