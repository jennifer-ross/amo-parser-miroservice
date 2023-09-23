import { Injectable } from '@nestjs/common'
import { PuppeteerService } from '../puppeteer/puppeteer.service'
import { QueueService } from '../queue/queue.service'
import { SendMessageType } from '../types/message'
import { WorkerPool } from '../worker.pool'

@Injectable()
export class MessageService {
	constructor(
		private readonly puppeteerService: PuppeteerService,
		private readonly queueService: QueueService,
		private readonly workerPool: WorkerPool,
	) {}

	async sendMessage(
		leadId: string,
		message: string,
		messageType: SendMessageType,
		chatId?: string,
		messageTheme?: string,
	) {
		const taskId = await this.workerPool.generateStringUtf8(10)
		return this.queueService.createJob(async () => {
			return await this.puppeteerService.sendMessage(
				leadId,
				message,
				messageType,
				taskId,
				chatId,
				messageTheme,
			)
		}, taskId)
	}
}
