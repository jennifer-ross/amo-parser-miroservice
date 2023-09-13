import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwtAuth.guard'
import { LeadsService } from './leads.service'

@Controller('leads')
export class LeadsController {
	constructor(private readonly leadsService: LeadsService) {}

	@UseGuards(JwtAuthGuard)
	@Get(':leadId')
	async getLead(@Param('leadId') leadId: string) {
		return await this.leadsService.getLead(leadId)
	}

	@UseGuards(JwtAuthGuard)
	@Get('/sources/:leadId')
	async getLeadSources(@Param('leadId') leadId: string) {
		return await this.leadsService.getLeadSources(leadId)
	}
}
