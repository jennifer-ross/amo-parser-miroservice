import { Injectable } from '@nestjs/common'
import { PuppeteerService } from '../puppeteer/puppeteer.service'

@Injectable()
export class LeadsService {
	constructor(private readonly puppeteerService: PuppeteerService) {}

	async getLead(leadId: string) {
		return await this.puppeteerService.getLead(leadId)
	}
}
