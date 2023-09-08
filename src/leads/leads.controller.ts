import { Controller, Get, Param } from '@nestjs/common'
import { PuppeteerService } from '../puppeteer/puppeteer.service'

@Controller('leads')
export class LeadsController {
	constructor(private readonly puppeteerService: PuppeteerService) {}

	@Get(':leadId')
	async getLead(@Param('leadId') leadId: string) {
		await this.puppeteerService.getLead(leadId)
	}
}
