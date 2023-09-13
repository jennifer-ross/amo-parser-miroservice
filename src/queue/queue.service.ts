import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Queue from 'queue'

@Injectable()
export class QueueService {
	private readonly queue = new Queue({ autostart: true })

	async createJob(job: Function) {
		const taskId = this.queue.push((cb) => {
			cb(null, job())
		})

		return {
			taskId,
		}
	}
}
