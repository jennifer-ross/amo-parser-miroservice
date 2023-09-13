import { isBoolean, toLower, parseInt } from 'lodash'
import { EncodingToken } from '../types/compression'
import * as process from 'process'
import * as fs from 'fs'
import * as path from 'path'
import { Algorithm } from 'jsonwebtoken'
import { VanillaPuppeteer } from 'puppeteer-extra'

export default () => ({
	isDev: process.env.NODE_ENV !== 'production' || 'production',
	port: parseInt(process.env.PORT, 10) || 3000,
	logs:
		(isBoolean(toLower(process.env.LOGS)) &&
			toLower(process.env.LOGS) === 'true') ||
		true,
	host: process.env.HOST || '127.0.0.1',
	sendEndpoint: process.env.SEND_ENDPOINT || '',
	compressionEncodings: ['gzip', 'deflate'] as EncodingToken[],
	saltRounds: parseInt(process.env.SALT_ROUNDS, 10) || 10,
	jwt: {
		algorithm: 'RS256' as Algorithm,
		issuer: process.env.JWT_ISSUER || '127.0.0.1',
		audience: process.env.JWT_AUDIENCE || '127.0.0.1',
		refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
		accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15d',
		accessPrivateKey:
			fs.readFileSync(
				path.join(process.cwd(), 'src/keys/jwtRS256.key'),
				'utf8',
			) || '',
		accessPublicKey:
			fs.readFileSync(
				path.join(process.cwd(), 'src/keys/jwtRS256.key.pub'),
				'utf8',
			) || '',
		refreshPrivateKey:
			fs.readFileSync(
				path.join(process.cwd(), 'src/keys/jwtRefreshRS256.key'),
				'utf8',
			) || '',
		refreshPublicKey:
			fs.readFileSync(
				path.join(process.cwd(), 'src/keys/jwtRefreshRS256.key.pub'),
				'utf8',
			) || '',
	},
	database: {
		name: process.env.DB_NAME || 'parser',
		uri: process.env.DB_HOST || 'localhost:27017',
		password: process.env.DB_PASSWORD || 'root',
		username: process.env.DB_USERNAME || 'root',
	},
	throttleTtl: parseInt(process.env.THROTTLE_TTL, 10) || 60,
	throttleLimit: parseInt(process.env.THROTTLE_LIMIT, 10) || 10,
	captcha: {
		id: process.env.CAPTCHA_ID || '2captcha',
		token: process.env.CAPTCHA_TOKEN || 'ENTER_YOUR_2CAPTCHA_API_KEY_HERE',
	},
	amo: {
		saveSession:
			(isBoolean(toLower(process.env.AMO_SAVE_SESSION)) &&
				toLower(process.env.AMO_SAVE_SESSION) === 'true') ||
			true,
		login: process.env.AMO_LOGIN || '',
		password: process.env.AMO_PASSWORD || '',
		crm: process.env.CRM_NAME || '',
	},
	parser: {
		launch: {
			headless: 'new',
			ignoreHTTPSErrors: true,
			handleNodeExit: [0, 1, 2], // chrome exits when process.exit(0) or process.exit(2)
			handleSIGINT: true,
			handleSIGTERM: true,
			handleSIGHUP: true,
			args: [
				`--window-size=1200,800`,
				'--disable-features=IsolateOrigins,site-per-process,SitePerProcess,AutomationControlled',
				'--flag-switches-begin --disable-site-isolation-trials --flag-switches-end',
				'--disable-features=site-per-process',
				'--disable-web-security',
				'--disable-gpu',
				'--disable-dev-shm-usage',
				'--disable-setuid-sandbox',
				'--no-first-run',
				'--no-sandbox',
				'--no-zygote',
				'--deterministic-fetch',
				'--disable-features=IsolateOrigins',
				'--disable-site-isolation-trials',
				'--no-zygote',
				'--unlimited-storage',
				'--full-memory-crash-report',
				'--force-gpu-mem-available-mb',
				'--disable-infobars',
			],
		} as Parameters<VanillaPuppeteer['launch']>[0],
		protocol: 'https',
		domain: 'amocrm.ru',
		trimRegex: /\n\r|\n\r$/gm,
		amoChatConstantRegex: /AMOCRM.constant\('amojo_chats',(.*?)\);/gm,
		selectors: {
			captcha: '#recaptcha',
			leadCreated: '.feed-note-wrapper-lead_created',
			scrollElement: '.notes-wrapper__scroller',
			feedSourceSwitcher: '.feed-compose-switcher__tip .tips-item',
			chatTargetSource: '.feed-compose-user__name.js-multisuggest-item',
			chatSourceItem: '.multisuggest__suggest-item.js-multisuggest-item',
			feedSourceSwitcherItem: '.feed-compose-switcher__tip .tips-item',
			feedSwitcher: '.feed-compose-switcher',
			feedSendField: '.feed-compose .feed-compose__inner .js-note',
			feedFieldMessage: '.feed-compose__message',
			feedSendBtn:
				'.feed-amojo__actions-inner .js-note-submit, .feed-note__actions .js-note-submit',
			feed: '.feed-note-wrapper:not(.feed-note-wrapper_grouped,.feed-note-wrapper-opened_talks)',
			feedConcatLinked: '.card-task__linked, .feed-note__linked',
			feedSms: 'feed-note-wrapper-sms',
			feedSmsText: '.feed-note__body',
			feedSystem: 'feed-note-wrapper_system',
			feedSystemStatusChanged: 'feed-note-wrapper-lead_status_changed',
			feedSystemStatusChangedText: '.feed-note__status-changed-wrapper',
			feedSystemFieldChanged: 'feed-note-wrapper-field_changed',
			feedSystemFieldChangedText: '.feed-note__field-changed-wrapper',
			feedNote: 'feed-note-wrapper-note',
			feedNoteText: '.feed-note__body',
			feedMail: 'feed-note-wrapper-mail_message',
			feedMailHeader: '.feed-note__header-inner-nowrap',
			feedMailContent: '.feed-note__mail-content',
			feedTask: 'feed-note-wrapper-task',
			feedTaskHeader:
				'.card-task__inner-header, .feed-note__header-inner',
			feedTaskHeaderInner:
				'.card-task__inner-header-left, .feed-note__header-inner-nowrap',
			feedTaskDate: '.card-task__date, .feed-note__date',
			feedTaskContent: '.feed-note__task-text, .card-task__inner-content',
			feedTaskResult: '.feed-note__task-result',
			feedTaskCompleted: '.feed-note__body_task-completed',
			feedCall: 'feed-note-wrapper-call_in_out',
			feedCallInner: '.feed-note__header-inner-nowrap',
			feedCallDate: '.feed-note__date',
			feedCallIncoming: '.feed-note-incoming',
			feedCallDateText: '.feed-note__date-text',
			feedCallContent: '.feed-note__call-content',
			feedCallDuration: '.feed-note__call-duration',
			feedCallUrl: '.feed-note__blue-link:not(.feed-note__call-player)',
			feedCallStatus: '.feed-note__call-status',
			feedDate: '.feed-note__date',
			feedIdAttr: 'data-id',
			feedFileIdAttr: 'data-file-id',
			feedExpandBtn: '.js-grouped-expand, .note-expander',
			feedsContainer: '.notes-wrapper__notes.js-notes',
			messageExpandBtn: '.js-show-more.feed-note__show-more',
			messageText:
				'.feed-note__message_paragraph, .feed-note__field-changed-wrapper, .feed-note__header-inner-wrap',
			messageAuthor: '.feed-note__amojo-user',
			messageAuthorNameAttr: 'title',
			messageAuthorIdAttr: 'data-id',
			messageAvatar: '.feed-note__avatar > div',
			messageAttach: '.feed-note__joined-attach',
			messageAttachIdAttr: 'data-file-id',
			messageAvatarUserIdAttr: 'id',
			loginField: '#session_end_login',
			passwordField: '#password',
			authSubmitBtn: '#auth_submit',
			mainField:
				'.card-fields__fields-block .linked-form__field:not(.linked-form__field_status-lead,.linked-forms__item_is-add,.linked-form__field-shower,.linked-form__field-name,.turn_field_a.turn)',
			mainFieldIdAttr: 'data-id',
			mainFieldIdAttr2: 'data-value',
			contactField: '.company_contacts:not(.company_contacts__company)',
			contactFields:
				'.linked-form__field:not(.linked-form__field_status-lead,.linked-forms__item_is-add,.linked-form__field-shower,.linked-form__field-name,.turn_field_a.turn)',
			companyField:
				'.company_contacts.company_contacts__company .linked-form__field:not(.linked-form__field_status-lead,.linked-forms__item_is-add,.linked-form__field-shower,.linked-form__field-name,.turn_field_a.turn)',
			mainFieldName: '.linked-form__field__label',
			// mainFieldNameSelect: '.control--select--button-inner',
			mainFieldNameSelect: '.control--select--button',
			mainFieldValue:
				'.linked-form__field__value .control-price, .linked-form__field__value .multisuggest__list-item, .linked-form__field__value .control--select--button-inner, .linked-form__field__value .checkboxes_dropdown__title-item, .linked-form__field__value .control-phone, .linked-form__field__value .js-linked-has-value',
			mainFieldValueSelect:
				'input.text-input, input.date_field, input.control--select--input',
			conversationUserId: '.company_contacts__list form input[name="ID"]',
		},
	},
})
