import { IAmoUsersList } from './user'
import { IAmoField } from './fields'
import { IAmoMessage, SendMessageType } from './message'

export interface IAmoLeadResponse {
	ids?: IAmoUsersList
	fields?: IAmoField[]
	contacts?: IAmoField[][]
	company?: IAmoField[]
	messages?: IAmoMessage[]
}
