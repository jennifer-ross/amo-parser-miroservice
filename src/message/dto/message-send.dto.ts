import { SendMessageType } from '../../types/message'

export class MessageSendDto {
	leadId: string
	message: string
	messageType: SendMessageType
	chatId?: string
}
