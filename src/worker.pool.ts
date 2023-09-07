import { Injectable } from '@nestjs/common'
import * as path from 'path'
import * as wp from 'workerpool'

@Injectable()
export class WorkerPool {
	private pool: wp.WorkerPool

	constructor() {
		this.pool = wp.pool(path.resolve(__dirname, 'workers/index.js'), {
			workerType: 'auto',
		})
	}
	public async hashPassword(password: string): Promise<string> {
		return await this.pool.exec('hashPassword', [password])
	}
	public async comparePassword(
		password: string,
		encrypted: string,
	): Promise<boolean> {
		return await this.pool.exec('comparePassword', [
			{ password, encrypted },
		])
	}

	public async generateStringHex(len: number): Promise<string> {
		return await this.pool.exec('generateStringHex', [len])
	}

	public async generateStringUtf8(len: number): Promise<string> {
		return await this.pool.exec('generateStringUtf8', [len])
	}
}
