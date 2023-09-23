import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwtAuth.guard'
import { MessageService } from './message.service'
import { MessageSendDto } from './dto/message-send.dto'

@Controller('message')
export class MessageController {
	constructor(private readonly messageService: MessageService) {}

	@UseGuards(JwtAuthGuard)
	@Post('/send')
	async sendMessage(@Body() messageSendDto: MessageSendDto) {
		return await this.messageService.sendMessage(
			messageSendDto.leadId,
			messageSendDto.message,
			messageSendDto.messageType,
			messageSendDto.chatId,
			messageSendDto.messageTheme,
		)
	}
}
