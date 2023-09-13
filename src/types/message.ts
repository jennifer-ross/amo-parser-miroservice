import { IAmoUser } from './user'

export interface IAmoMailContact {
	name: string
	url: string
}

export interface IAmoMessageAttach {
	id: string
	url: string
}

export interface IAmoMailContent {
	text: string
	url: string
}

export interface IAmoMail {
	from: string
	to: string
	content: IAmoMailContent
	contact: IAmoMailContact
}

export interface IAmoTaskContent {
	text: string
	result: string
}

export interface IAmoTaskContact extends IAmoMailContact {}

export interface IAmoTask {
	from: string
	to: string
	content: IAmoTaskContent
	contact?: IAmoTaskContact
	completed: boolean
}

export interface IAmoCallContact extends IAmoTaskContact {}
export interface IAmoCallContent extends IAmoMailContent {}

export interface IAmoColl {
	from: string
	to: string
	contact: IAmoCallContact
	content: IAmoCallContent
	status: string
}

export interface IAmoSmsContact extends IAmoTaskContact {}
export interface IAmoSmsContent extends IAmoTaskContent {}

export interface IAmoSms {
	content: IAmoSmsContent
	contact?: IAmoSmsContact
}

export interface IAmoSystemContact extends IAmoTaskContact {}
export interface IAmoSystemContent extends IAmoTaskContent {}

export interface IAmoSystem {
	content: IAmoSystemContent
	contact?: IAmoSystemContact
}

export type SendMessageType = 'chat' | 'email' | 'note'

export interface IAmoMessage {
	author: IAmoUser
	date: string
	dateIso: number
	id: string
	text: string
	attach?: IAmoMessageAttach
	mail?: IAmoMail
	task?: IAmoTask
	call?: IAmoColl
	system?: IAmoSystem
	sms?: IAmoSms
}
