import { Injectable } from '@nestjs/common'
import Queue from 'queue'

@Injectable()
export class QueueService {
	private readonly queue = new Queue({ autostart: true })

	async createJob(job: Function, taskId: string) {
		this.queue.push((cb) => {
			cb(null, job())
		})

		return {
			taskId,
		}
	}
}
