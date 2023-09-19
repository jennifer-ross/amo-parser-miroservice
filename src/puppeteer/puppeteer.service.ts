import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ElementHandle, Frame, Page } from 'puppeteer'
import { WorkerPool } from '../worker.pool'
import { ConfigService } from '@nestjs/config'
import * as path from 'path'
import * as fs from 'fs'
import process from 'process'
import { isEmpty } from 'lodash'
import { Protocol } from 'devtools-protocol'
import configuration from '../config/configuration'
import { sleep } from '../utils'
import { IAmoMessage, SendMessageType } from '../types/message'
import { IAmoField } from '../types/fields'
import { IAmoUsersList } from '../types/user'
import moment from 'moment'
import { Cluster } from 'puppeteer-cluster'
import { IAmoLeadResponse } from '../types/response'
import { PuppeteerExtra } from 'puppeteer-extra'
import { HttpService } from '@nestjs/axios'
import axios from 'axios'

@Injectable()
export class PuppeteerService {
	private readonly logger = new Logger(PuppeteerService.name)

	private frame: Frame = null
	private isAuth: boolean = false
	private readonly timeout = 3600000

	private cookiePath: string = path.join(process.cwd(), 'cookies.json')
	private amoUsersIds: IAmoUsersList = {
		users: {},
		contacts: {},
	}

	constructor(
		private readonly workerPool: WorkerPool,
		private readonly configService: ConfigService,
		private readonly httpService: HttpService,
	) {}

	async getEvaluateScript(
		scriptName: string,
		params: any[],
	): Promise<string> {
		return (await import(`./evaluate/${scriptName}.js`)).default(
			...params,
		) as string
	}

	private async loadCookies() {
		if (fs.existsSync(this.cookiePath)) {
			const cookies = JSON.parse(fs.readFileSync(this.cookiePath, 'utf8'))

			if (
				cookies.hasOwnProperty('last_login') &&
				cookies.last_login.value !==
					this.configService.get<string>('amo.login')
			) {
				await this.saveCookies({})
				return {}
			} else {
				return cookies
			}
		}

		return {}
	}

	private async saveCookies(data: any) {
		this.logger.log('Saving cookies...')
		return fs.writeFileSync(this.cookiePath, JSON.stringify(data), 'utf8')
	}

	private async setCookiesToPage(): Promise<Page> {
		let cookies = await this.loadCookies()

		const cookieValues = Object.values(
			cookies,
		) as Protocol.Network.CookieParam[]

		await this.frame.page().setCookie(...cookieValues)
		this.logger.log('Cookies was set to page')

		return this.frame.page()
	}

	private async expandFeeds(): Promise<Page> {
		this.logger.log('Expand all feeds on page...')

		const expandBtns = await this.frame
			.page()
			.$$(
				this.configService.get<string>(
					'parser.selectors.feedExpandBtn',
				),
			)

		for (const expandBtn of expandBtns) {
			await expandBtn.click({ delay: 30 })
			await sleep(1000)
		}

		return this.frame.page()
	}

	private async expandMessages(): Promise<Page> {
		this.logger.log('Expand all messages on page...')
		let moreBtns: ElementHandle<Element>[] = null

		do {
			moreBtns = await this.frame
				.page()
				.$$(
					this.configService.get<string>(
						'parser.selectors.messageExpandBtn',
					),
				)

			try {
				for (const moreBtn of moreBtns) {
					await moreBtn.click({ delay: 30 })
				}
			} catch (e) {}

			await sleep(1000)
		} while (moreBtns.length > 0)

		return this.frame.page()
	}

	private async onLoad() {
		const finalCookie = {}
		await this.frame.page().on('load', async () => {
			this.logger.log('OnLoad page event...')

			this.isAuth = await this.authorise()

			let cookies = await this.frame.page().cookies()

			this.logger.log('Authorise get cookies...')

			cookies.forEach((item) => {
				finalCookie[item.name] = item
			})

			if (this.configService.get('amo.saveSession')) {
				this.logger.log('Authorise save cookies...')
				await this.saveCookies(finalCookie)
			}
		})

		return finalCookie
	}

	private async onRequest() {
		this.frame.page().on('request', async (request) => {
			try {
				// Capture any request that is a navigation requests that attempts to load a new document
				// This will capture HTTP Status 301, 302, 303, 307, 308, HTML, and Javascript redirects
				if (
					request.isNavigationRequest() &&
					request.resourceType() === 'document'
				) {
					this.logger.log(
						`OnRequest page event navigate to: ${request.url()}`,
					)
					this.frame = request.frame()
					await Promise.all([request.continue()])
				} else {
					await request.continue()
				}
			} catch (e) {}
		})
	}

	private async authorise(): Promise<boolean> {
		const page = this.frame.page()

		const authField = await page.$(
			`${this.configService.get<string>('parser.selectors.loginField')}`,
		)
		const passwordField = await page.$(
			`${this.configService.get<string>(
				'parser.selectors.passwordField',
			)}`,
		)
		const authSubmitBtn = await page.$(
			`${this.configService.get<string>(
				'parser.selectors.authSubmitBtn',
			)}`,
		)

		if (authField && passwordField && authSubmitBtn) {
			this.logger.log('Starting authorise...')
			this.isAuth = true
			// Click for select any saved text and remove when typing
			await authField.click({ count: 3 })
			await authField.type(`${this.configService.get('amo.login')}`, {
				delay: 120,
			})
			this.logger.log('Authorise click and type authField...')
			// Click for select any saved text and remove when typing
			await passwordField.click({ count: 3 })
			await passwordField.type(
				`${this.configService.get('amo.password')}`,
				{
					delay: 120,
				},
			)
			this.logger.log('Authorise click and type passwordField...')
			await authSubmitBtn.click({ delay: 30 })
			this.logger.log('Authorise click authSubmitBtn...')
			return true

			// await page.waitForSelector('body')

			// const captcha = await page.$(
			// 	`${this.configService.get<string>('parser.selectors.captcha')}`,
			// )
			//
			// if (captcha) {
			// 	await page.solveRecaptchas()
			// 	await authSubmitBtn.click({ delay: 30 })
			// 	await sleep(5000)
			// }
		}

		return false
	}

	private async scrollToStartLead() {
		this.logger.log('Scrolling to up page for load data...')
		let feedCreated = null

		do {
			feedCreated = await this.frame
				.page()
				.$(
					`${this.configService.get<string>(
						'parser.selectors.leadCreated',
					)}`,
				)
			try {
				await this.frame.page().evaluate(
					(scrollElementSelector: string) =>
						Array.from(
							document.querySelectorAll(
								`${scrollElementSelector}`,
							),
							(element) => {
								element.scrollTo({
									top: 0,
									behavior: 'instant',
								})
							},
						),
					this.configService.get<string>(
						'parser.selectors.scrollElement',
					),
				)
			} catch (e) {}
			await sleep(1000)
		} while (feedCreated === null)
	}

	private async applyDefaultActions(page: Page): Promise<void> {
		this.logger.log('Start do default actions...')
		this.frame = page.mainFrame()
		await this.frame.page().setDefaultNavigationTimeout(this.timeout)
		await this.setCookiesToPage()
		await this.onLoad()
		await this.onRequest()
		this.logger.log('Default actions has does successful')
	}

	private async parseAmoChatConstantUserIds() {
		this.logger.log('Parsing chat constant data...')

		await this.frame
			.page()
			.waitForSelector(
				this.configService.get<string>(
					'parser.selectors.feedsContainer',
				),
			)

		const constant = await this.frame.page().evaluate((regex: RegExp) => {
			const amoChatConstant = document.body.querySelectorAll('script')
			for (const amoChatConstantElement of amoChatConstant) {
				const matches = amoChatConstantElement.innerHTML.match(
					/AMOCRM.constant\('amojo_chats',(.*?)\);/gm,
				)
				if (matches && Array.isArray(matches) && matches.length > 0) {
					return matches
						.pop()
						.replace("AMOCRM.constant('amojo_chats',", '')
						.replace(');', '')
						.trim()
				}
			}
		}, this.configService.get<RegExp>('parser.amoChatConstantRegex'))

		if (constant) {
			try {
				const users: IAmoUsersList = {
					users: {},
					contacts: {},
				}
				const chats = JSON.parse(constant) as Object

				for (const [chatId, chat] of Object.entries(chats)) {
					const chatUsers = chat.users as Object
					const chatContacts = chat.contacts as Object

					for (const [userId, user] of Object.entries(chatUsers)) {
						users.users[userId] = user.id
					}

					for (const [contactId, contact] of Object.entries(
						chatContacts,
					)) {
						users.contacts[contactId] = contact.id
					}
				}

				return users
			} catch (e) {}
		}

		return { users: {}, contacts: {} } as IAmoUsersList
	}

	private async parseMessages(
		onlyLast: boolean = false,
	): Promise<IAmoMessage[]> {
		this.logger.log('Parse messages of lead...')
		const messageList = (await this.frame.page().evaluate(
			(
				onlyLast,
				feedIdAttr: string,
				feedSms: string,
				feedSmsText: string,
				feedSystem: string,
				feedSystemStatusChanged: string,
				feedSystemStatusChangedText: string,
				feedSystemFieldChanged: string,
				feedSystemFieldChangedText: string,
				feedNote: string,
				feedNoteText: string,
				feedMail: string,
				feedMailHeader: string,
				feedMailContent: string,
				feedTask: string,
				feedTaskHeader: string,
				feedTaskHeaderInner: string,
				feedTaskDate: string,
				feedTaskContent: string,
				feedTaskResult: string,
				feedTaskCompleted: string,
				feedCall: string,
				feedCallInner: string,
				feedCallDate: string,
				feedCallIncoming: string,
				feedCallDateText: string,
				feedCallContent: string,
				feedCallDuration: string,
				feedCallUrl: string,
				feedCallStatus: string,
				feedConcatLinked: string,
				feedSelector: string,
				feedDateSelector: string,
				messageTextSelector: string,
				messageAuthor: string,
				messageAuthorNameAttr: string,
				messageAuthorIdAttr: string,
				messageAvatar: string,
				messageAvatarUserIdAttr: string,
				messageAttach: string,
				messageAttachIdAttr: string,
				baseUrl: string,
				regex: RegExp,
			) => {
				const elements = document.querySelectorAll(`${feedSelector}`)
				let parseElements = null
				if (onlyLast) {
					parseElements = [elements[elements.length - 1]]
				} else {
					parseElements = elements
				}

				return Array.from(parseElements, (element: Element) => {
					const messageObj = {}
					const feedId = element.getAttribute(`${feedIdAttr}`)
					const feedDate = element.querySelector(
						`${feedDateSelector}`,
					)
					let message = element.querySelector(
						`${messageTextSelector}`,
					)

					messageObj['text'] = message ? message.textContent : null
					messageObj['id'] = feedId
					messageObj['date'] = feedDate
						? feedDate.textContent.replace(regex, '').trim()
						: null

					const msgAuthor = element.querySelector(`${messageAuthor}`)
					if (msgAuthor) {
						const authorName = msgAuthor.getAttribute(
							`${messageAuthorNameAttr}`,
						)
						const authorId = msgAuthor.getAttribute(
							`${messageAuthorIdAttr}`,
						)

						messageObj['author'] = {
							name: authorName,
							id: authorId,
							contactId: null,
						}
					}

					const avatar = element.querySelector(`${messageAvatar}`)
					if (avatar) {
						const contactId = avatar.getAttribute(
							`${messageAvatarUserIdAttr}`,
						)

						if (
							messageObj.hasOwnProperty('author') &&
							messageObj['author']
						) {
							messageObj['author'].contactId = contactId
						} else {
							messageObj['author'] = {}
							messageObj['author'].contactId = contactId
							messageObj['author'].id = contactId
							messageObj['author'].name = null
						}
					}

					const attachEl = element.querySelector(`${messageAttach}`)
					if (attachEl) {
						const attachUrlEl = attachEl.querySelector('a')
						if (attachUrlEl) {
							messageObj['attach'] = {
								id: attachEl.getAttribute(
									`${messageAttachIdAttr}`,
								),
								url: attachUrlEl.getAttribute('href'),
							}
						}
					}

					// Element is system message
					if (element.classList.contains(feedSystem)) {
						messageObj['system'] = {
							content: {
								text: '',
							},
						}

						if (
							element.classList.contains(
								feedSystemFieldChanged,
							) ||
							element.classList.contains(feedSystemStatusChanged)
						) {
							const text = element.querySelector(
								`${feedSystemFieldChangedText}, ${feedSystemStatusChangedText}`,
							)
							if (text) {
								messageObj['system'].content.text =
									text.textContent.replace(regex, '').trim()
								messageObj['text'] =
									messageObj['system'].content.text
							}

							if (
								!messageObj['author'] ||
								(messageObj['author'].hasOwnProperty('id') &&
									!messageObj['author'].id)
							) {
								delete messageObj['author']
							}
						}

						const contact = element.querySelector(
							`${feedConcatLinked}`,
						)
						if (contact) {
							const urlEl = contact.querySelector('a')
							if (urlEl) {
								messageObj['system'].contact = {
									url: `${baseUrl}${urlEl.getAttribute(
										'href',
									)}`,
									name: urlEl.textContent
										.replace(regex, '')
										.trim(),
								}
							}
						}

						if (
							!messageObj['system'].content.text &&
							messageObj['text']
						) {
							messageObj['system'].content.text =
								messageObj['text']
						}
					}

					// Element is sms
					if (element.classList.contains(feedSms)) {
						messageObj['sms'] = {
							content: {
								text: '',
							},
						}

						const text = element.querySelector(`${feedSmsText}`)
						if (text) {
							messageObj['sms'].content.text = text.textContent
								.replace(regex, '')
								.trim()
							messageObj['text'] = messageObj['sms'].content.text
						}

						const contact = element.querySelector(
							`${feedConcatLinked}`,
						)
						if (contact) {
							const urlEl = contact.querySelector('a')
							if (urlEl) {
								messageObj['sms'].contact = {
									url: `${baseUrl}${urlEl.getAttribute(
										'href',
									)}`,
									name: urlEl.textContent
										.replace(regex, '')
										.trim(),
								}
							}
						}
					}

					// Element is note
					if (element.classList.contains(feedNote)) {
						const text = element.querySelector(`${feedNoteText}`)

						if (text) {
							messageObj['text'] = text.textContent
								.replace(regex, '')
								.trim()
						}
					}

					// Element is mail
					if (element.classList.contains(feedMail)) {
						delete messageObj['author']
						const messageHeader = element.querySelector(
							`${feedMailHeader}`,
						)

						if (messageHeader) {
							messageObj['mail'] = {
								from: '',
								to: '',
								contact: {
									url: '',
									name: '',
								},
								content: {
									text: '',
									url: '',
								},
							}
							const messageHeaderSplit =
								messageHeader.innerHTML.split('&nbsp;')
							if (messageHeaderSplit.length > 0) {
								messageObj[
									'date'
								] = `${messageHeaderSplit.shift()}:00.000`
							}
							const mailAuthors = messageHeader.querySelectorAll(
								`${messageAuthor}`,
							)

							if (mailAuthors.length === 2) {
								messageObj['mail'].from = mailAuthors
									.item(0)
									.textContent.replace(regex, '')
									.trim()
								messageObj['mail'].to = mailAuthors
									.item(1)
									.textContent.replace(regex, '')
									.trim()
							}

							const contact = element.querySelector(
								`${feedConcatLinked}`,
							)

							if (contact) {
								const urlEl = contact.querySelector('a')
								if (urlEl) {
									messageObj['mail'].contact = {
										url: `${baseUrl}${urlEl.getAttribute(
											'href',
										)}`,
										name: urlEl.textContent
											.replace(regex, '')
											.trim(),
									}
								}
							}

							const content = element.querySelector(
								`${feedMailContent}`,
							)
							if (content) {
								const urlContentEl = content.querySelector('a')
								if (urlContentEl) {
									messageObj['mail'].content = {
										text: urlContentEl.textContent
											.replace(regex, '')
											.trim(),
										url: urlContentEl.getAttribute('href'),
									}
								}
							}

							if (
								!messageObj['mail'].content.text &&
								messageObj['text']
							) {
								messageObj['mail'].content.text =
									messageObj['text']
							}
						}
					}

					// Element is task
					if (element.classList.contains(feedTask)) {
						const taskHeader = element.querySelector(
							`${feedTaskHeader}`,
						)
						delete messageObj['author']
						messageObj['task'] = {
							from: '',
							to: '',
							content: {
								text: '',
								result: '',
							},
							completed: false,
						}

						if (taskHeader) {
							const takHeaderInner = taskHeader.querySelector(
								`${feedTaskHeaderInner}`,
							)
							if (takHeaderInner) {
								const takHeaderInnerSplit =
									takHeaderInner.innerHTML.split('&nbsp;')

								if (takHeaderInnerSplit.length === 5) {
									messageObj['task'].from =
										takHeaderInnerSplit[2]
									messageObj['task'].to =
										takHeaderInnerSplit[4]
								} else if (takHeaderInnerSplit.length === 3) {
									messageObj['task'].to =
										takHeaderInnerSplit[2]
								}
							}

							const date = taskHeader.querySelector(
								`${feedTaskDate}`,
							)
							if (date) {
								const dateSplit = date.innerHTML.split('<b')
								messageObj['date'] = `${dateSplit
									.shift()
									.trim()}:00.000`
							}

							const contact = element.querySelector(
								`${feedConcatLinked}`,
							)
							if (contact) {
								const urlEl = contact.querySelector('a')
								if (urlEl) {
									messageObj['task'].contact = {
										url: `${baseUrl}${urlEl.getAttribute(
											'href',
										)}`,
										name: urlEl.textContent
											.replace(regex, '')
											.trim(),
									}
								}
							}
						}

						const text = element.querySelector(`${feedTaskContent}`)
						if (text) {
							messageObj['task'].content.text = text.textContent
								.replace(regex, '')
								.trim()
						}

						const result = element.querySelector(
							`${feedTaskResult}`,
						)
						if (result) {
							messageObj['task'].content.result =
								result.textContent.replace(regex, '').trim()
						}

						const completed = element.querySelector(
							`${feedTaskCompleted}`,
						)
						if (completed) {
							messageObj['task'].completed = true
						}

						if (
							!messageObj['task'].content.text &&
							messageObj['text']
						) {
							messageObj['task'].content.text = messageObj['text']
						}
					}

					// Element is call
					if (element.classList.contains(feedCall)) {
						delete messageObj['author']
						messageObj['call'] = {
							from: '',
							to: '',
							contact: {
								url: '',
								name: '',
							},
							content: {
								text: '',
								url: '',
							},
							status: '',
						}

						const callInner = element.querySelector(
							`${feedCallInner}`,
						)
						if (callInner) {
							const callSplit =
								callInner.innerHTML.split('&nbsp;')

							const date = callInner.querySelector(
								`${feedCallDate}`,
							)

							if (date) {
								messageObj['date'] = date.textContent
									.replace(regex, '')
									.trim()
							}

							if (element.querySelector(`${feedCallIncoming}`)) {
								const to = callInner.querySelector(
									`${messageAuthor}`,
								)

								if (to) {
									messageObj['call'].to = to.textContent
										.replace(regex, '')
										.trim()
								} else {
									messageObj['call'].to = callSplit[3]
										.replace(regex, '')
										.replace('кому:</span>', '')
										.trim()
								}

								const callText = callInner.querySelector(
									`${feedCallDateText}`,
								)

								if (callText) {
									const callTextSplit =
										callText.innerHTML.split('&nbsp;')
									if (callTextSplit.length === 3) {
										messageObj['call'].from =
											callTextSplit[1]
												.replace(regex, '')
												.trim()
									}
								}
							} else {
								const from = callInner.querySelector(
									`${messageAuthor}`,
								)

								if (from) {
									messageObj['call'].from = from.textContent
										.replace(regex, '')
										.trim()
								} else {
									const fromSplit =
										callSplit[1].split('</span>')

									if (fromSplit.length === 2) {
										messageObj['call'].from = fromSplit[1]
											.replace(regex, '')
											.trim()
									}
								}

								if (callSplit.length === 4) {
									messageObj['call'].to = callSplit[3]
										.replace(regex, '')
										.trim()
								}
							}
						}

						const text = element.querySelector(`${feedCallContent}`)
						if (text) {
							const textSplit = text.innerHTML.split('&nbsp;')
							messageObj['call'].content.text = textSplit
								.shift()
								.replace(regex, '')
								.trim()
						}

						const duration = element.querySelector(
							`${feedCallDuration}`,
						)
						if (duration && messageObj['call'].content.text) {
							messageObj[
								'call'
							].content.text += ` ${duration.textContent
								.replace(regex, '')
								.trim()}`
						}

						const url = element.querySelector(`${feedCallUrl}`)
						if (url) {
							messageObj['call'].content.url =
								url.getAttribute('href')
						}

						const contact = element.querySelector(
							`${feedConcatLinked}`,
						)
						if (contact) {
							const urlEl = contact.querySelector('a')
							if (urlEl) {
								messageObj['call'].contact = {
									url: `${baseUrl}${urlEl.getAttribute(
										'href',
									)}`,
									name: urlEl.textContent
										.replace(regex, '')
										.trim(),
								}
							}
						}

						const status = element.querySelector(
							`${feedCallStatus}`,
						)
						if (status) {
							messageObj['call'].status = status.textContent
								.replace(regex, '')
								.trim()
						}

						if (
							!messageObj['call'].content.text &&
							messageObj['text']
						) {
							messageObj['call'].content.text = messageObj['text']
						}
					}

					return messageObj
				})
			},
			onlyLast,
			this.configService.get<string>('parser.selectors.feedIdAttr'),
			this.configService.get<string>('parser.selectors.feedSms'),
			this.configService.get<string>('parser.selectors.feedSmsText'),
			this.configService.get<string>('parser.selectors.feedSystem'),
			this.configService.get<string>(
				'parser.selectors.feedSystemStatusChanged',
			),
			this.configService.get<string>(
				'parser.selectors.feedSystemStatusChangedText',
			),
			this.configService.get<string>(
				'parser.selectors.feedSystemFieldChanged',
			),
			this.configService.get<string>(
				'parser.selectors.feedSystemFieldChangedText',
			),
			this.configService.get<string>('parser.selectors.feedNote'),
			this.configService.get<string>('parser.selectors.feedNoteText'),
			this.configService.get<string>('parser.selectors.feedMail'),
			this.configService.get<string>('parser.selectors.feedMailHeader'),
			this.configService.get<string>('parser.selectors.feedMailContent'),
			this.configService.get<string>('parser.selectors.feedTask'),
			this.configService.get<string>('parser.selectors.feedTaskHeader'),
			this.configService.get<string>(
				'parser.selectors.feedTaskHeaderInner',
			),
			this.configService.get<string>('parser.selectors.feedTaskDate'),
			this.configService.get<string>('parser.selectors.feedTaskContent'),
			this.configService.get<string>('parser.selectors.feedTaskResult'),
			this.configService.get<string>(
				'parser.selectors.feedTaskCompleted',
			),
			this.configService.get<string>('parser.selectors.feedCall'),
			this.configService.get<string>('parser.selectors.feedCallInner'),
			this.configService.get<string>('parser.selectors.feedCallDate'),
			this.configService.get<string>('parser.selectors.feedCallIncoming'),
			this.configService.get<string>('parser.selectors.feedCallDateText'),
			this.configService.get<string>('parser.selectors.feedCallContent'),
			this.configService.get<string>('parser.selectors.feedCallDuration'),
			this.configService.get<string>('parser.selectors.feedCallUrl'),
			this.configService.get<string>('parser.selectors.feedCallStatus'),
			this.configService.get<string>('parser.selectors.feedConcatLinked'),
			this.configService.get<string>('parser.selectors.feed'),
			this.configService.get<string>('parser.selectors.feedDate'),
			this.configService.get<string>('parser.selectors.messageText'),
			this.configService.get<string>('parser.selectors.messageAuthor'),
			this.configService.get<string>(
				'parser.selectors.messageAuthorNameAttr',
			),
			this.configService.get<string>(
				'parser.selectors.messageAuthorIdAttr',
			),
			this.configService.get<string>('parser.selectors.messageAvatar'),
			this.configService.get<string>(
				'parser.selectors.messageAvatarUserIdAttr',
			),
			this.configService.get<string>('parser.selectors.messageAttach'),
			this.configService.get<string>(
				'parser.selectors.messageAttachIdAttr',
			),
			`${this.configService.get<string>(
				'parser.protocol',
			)}://${this.configService.get<string>(
				'amo.crm',
			)}.${this.configService.get<string>('parser.domain')}`,
			this.configService.get<RegExp>('parser.trimRegex'),
		)) as IAmoMessage[]

		for (let i = 0; i < messageList.length; i++) {
			const message = messageList[i]

			if (!isEmpty(message.date)) {
				let currentDate = new Date()
				let date = message.date.replace(
					'Сегодня',
					currentDate
						.toJSON()
						.slice(0, 10)
						.split('-')
						.reverse()
						.join('.'),
				)
				currentDate.setDate(currentDate.getDate() - 1)
				date = date.replace(
					'Вчера',
					currentDate
						.toJSON()
						.slice(0, 10)
						.split('-')
						.reverse()
						.join('.'),
				)

				message.dateIso = moment(date, ['DD-MM-YYYY']).unix()
			}

			if (isEmpty(message.author)) continue

			if (
				isEmpty(message.author.contactId) &&
				!isEmpty(message.author.id)
			) {
				message.author.contactId =
					this.amoUsersIds.contacts[message.author.id]
			}
			if (
				isEmpty(message.author.id) &&
				!isEmpty(message.author.contactId)
			) {
				for (const [userId, userContactId] of Object.entries(
					this.amoUsersIds.users,
				)) {
					if (
						Number(userContactId) ===
						Number(message.author.contactId)
					) {
						message.author.id = userId
					}
				}
			}
			if (
				isEmpty(message.author.contactId) &&
				!isEmpty(message.author.id)
			) {
				message.author.contactId = message.author.id
			}
		}

		return messageList
	}

	private async parseContactFields(): Promise<IAmoField[][]> {
		this.logger.log('Parse contact fields of lead...')
		return (await this.frame.page().evaluate(
			(
				contactField: string,
				contactFields: string,
				mainFieldIdAttr: string,
				mainFieldIdAttr2: string,
				mainFieldNameSelect: string,
				mainFieldName: string,
				mainFieldValue: string,
				mainFieldValueSelect: string,
				regex: RegExp,
			) =>
				Array.from(
					document.querySelectorAll(`${contactField}`),
					(contactElement) => {
						return Array.from(
							contactElement.querySelectorAll(`${contactFields}`),
							(element) => {
								let fieldLabelText = ''
								let fieldId = element.getAttribute(
									`${mainFieldIdAttr}`,
								)

								const fieldLabel = element.querySelector(
									`${mainFieldName}`,
								)

								if (fieldLabel) {
									const fieldNameSelect =
										fieldLabel.querySelector(
											`${mainFieldNameSelect}`,
										)

									if (fieldNameSelect) {
										fieldLabelText =
											fieldNameSelect.textContent

										if (!fieldId) {
											fieldId =
												fieldNameSelect.getAttribute(
													`${mainFieldIdAttr2}`,
												)
										}
									} else {
										fieldLabelText = fieldLabel
											? fieldLabel.textContent
											: null
									}
								}

								let fieldValueText = ''
								const fieldValue = element.querySelector(
									`${mainFieldValue}`,
								)

								if (fieldValue) {
									const fieldValueSelect =
										fieldValue.querySelector(
											`${mainFieldValueSelect}`,
										)

									if (fieldValueSelect) {
										// Input element
										fieldValueText =
											fieldValueSelect.getAttribute(
												'value',
											)
									} else {
										fieldValueText = fieldValue
											? fieldValue.textContent
											: null
									}
								}

								fieldLabelText = fieldLabelText
									.replace(regex, '')
									.trim()
								fieldValueText = fieldValueText
									.replace(regex, '')
									.trim()

								return {
									id: fieldId,
									name: fieldLabelText,
									value: fieldValueText,
								}
							},
						)
					},
				),
			this.configService.get<string>('parser.selectors.contactField'),
			this.configService.get<string>('parser.selectors.contactFields'),
			this.configService.get<string>('parser.selectors.mainFieldIdAttr'),
			this.configService.get<string>('parser.selectors.mainFieldIdAttr2'),
			this.configService.get<string>(
				'parser.selectors.mainFieldNameSelect',
			),
			this.configService.get<string>('parser.selectors.mainFieldName'),
			this.configService.get<string>('parser.selectors.mainFieldValue'),
			this.configService.get<string>(
				'parser.selectors.mainFieldValueSelect',
			),
			this.configService.get<RegExp>('parser.trimRegex'),
		)) as IAmoField[][]
	}

	private async parseCompanyFields(): Promise<IAmoField[]> {
		this.logger.log('Parse company fields of lead...')
		return (await this.frame.page().evaluate(
			(
				companyField: string,
				mainFieldIdAttr: string,
				mainFieldIdAttr2: string,
				mainFieldNameSelect: string,
				mainFieldName: string,
				mainFieldValue: string,
				mainFieldValueSelect: string,
				regex: RegExp,
			) =>
				Array.from(
					document.querySelectorAll(`${companyField}`),
					(element) => {
						let fieldLabelText = ''
						let fieldId = element.getAttribute(`${mainFieldIdAttr}`)

						const fieldLabel = element.querySelector(
							`${mainFieldName}`,
						)

						if (fieldLabel) {
							const fieldNameSelect = fieldLabel.querySelector(
								`${mainFieldNameSelect}`,
							)

							if (fieldNameSelect) {
								fieldLabelText = fieldNameSelect.textContent

								if (!fieldId) {
									fieldId = fieldNameSelect.getAttribute(
										`${mainFieldIdAttr2}`,
									)
								}
							} else {
								fieldLabelText = fieldLabel
									? fieldLabel.textContent
									: null
							}
						}

						let fieldValueText = ''
						const fieldValue = element.querySelector(
							`${mainFieldValue}`,
						)

						if (fieldValue) {
							const fieldValueSelect = fieldValue.querySelector(
								`${mainFieldValueSelect}`,
							)

							if (fieldValueSelect) {
								// Input element
								fieldValueText =
									fieldValueSelect.getAttribute('value')
							} else {
								fieldValueText = fieldValue
									? fieldValue.textContent
									: null
							}
						}

						fieldLabelText = fieldLabelText
							.replace(regex, '')
							.trim()
						fieldValueText = fieldValueText
							.replace(regex, '')
							.trim()

						return {
							id: fieldId,
							name: fieldLabelText,
							value: fieldValueText,
						}
					},
				),
			this.configService.get<string>('parser.selectors.companyField'),
			this.configService.get<string>('parser.selectors.mainFieldIdAttr'),
			this.configService.get<string>('parser.selectors.mainFieldIdAttr2'),
			this.configService.get<string>(
				'parser.selectors.mainFieldNameSelect',
			),
			this.configService.get<string>('parser.selectors.mainFieldName'),
			this.configService.get<string>('parser.selectors.mainFieldValue'),
			this.configService.get<string>(
				'parser.selectors.mainFieldValueSelect',
			),
			this.configService.get<RegExp>('parser.trimRegex'),
		)) as IAmoField[]
	}

	private async parseMainFields(): Promise<IAmoField[]> {
		this.logger.log('Parse main fields of lead...')
		return (await this.frame.page().evaluate(
			(
				mainField: string,
				mainFieldIdAttr: string,
				mainFieldIdAttr2: string,
				mainFieldNameSelect: string,
				mainFieldName: string,
				mainFieldValue: string,
				mainFieldValueSelect: string,
				regex: RegExp,
			) =>
				Array.from(
					document.querySelectorAll(`${mainField}`),
					(element) => {
						let fieldLabelText = ''
						let fieldId = element.getAttribute(`${mainFieldIdAttr}`)

						const fieldLabel = element.querySelector(
							`${mainFieldName}`,
						)

						if (fieldLabel) {
							const fieldNameSelect = fieldLabel.querySelector(
								`${mainFieldNameSelect}`,
							)

							if (fieldNameSelect) {
								fieldLabelText = fieldNameSelect.textContent

								if (!fieldId) {
									fieldId = fieldNameSelect.getAttribute(
										`${mainFieldIdAttr2}`,
									)
								}
							} else {
								fieldLabelText = fieldLabel
									? fieldLabel.textContent
									: null
							}
						}

						let fieldValueText = ''
						const fieldValue = element.querySelector(
							`${mainFieldValue}`,
						)

						if (fieldValue) {
							const fieldValueSelect = fieldValue.querySelector(
								`${mainFieldValueSelect}`,
							)

							if (fieldValueSelect) {
								// Input element
								fieldValueText =
									fieldValueSelect.getAttribute('value')
							} else {
								fieldValueText = fieldValue
									? fieldValue.textContent
									: null
							}
						}

						fieldLabelText = fieldLabelText
							.replace(regex, '')
							.trim()
						fieldValueText = fieldValueText
							.replace(regex, '')
							.trim()

						return {
							id: fieldId,
							name: fieldLabelText,
							value: fieldValueText,
						}
					},
				),
			this.configService.get<string>('parser.selectors.mainField'),
			this.configService.get<string>('parser.selectors.mainFieldIdAttr'),
			this.configService.get<string>('parser.selectors.mainFieldIdAttr2'),
			this.configService.get<string>(
				'parser.selectors.mainFieldNameSelect',
			),
			this.configService.get<string>('parser.selectors.mainFieldName'),
			this.configService.get<string>('parser.selectors.mainFieldValue'),
			this.configService.get<string>(
				'parser.selectors.mainFieldValueSelect',
			),
			this.configService.get<RegExp>('parser.trimRegex'),
		)) as IAmoField[]
	}

	private async sendMessageToLead(
		page: Page,
		message: string,
		messageType: SendMessageType,
		chatId?: string,
	): Promise<boolean> {
		this.logger.log('Sending message to lead...')

		const availableSources = await this.frame
			.page()
			.$$eval(
				this.configService.get<string>(
					'parser.selectors.feedSourceSwitcher',
				),
				(elements) => elements.map((el) => el.getAttribute('data-id')),
			)

		if (availableSources.length === 0) {
			return false
		}

		if (!availableSources.find((source) => source === messageType)) {
			return false
		}

		const feedSelector = await this.frame
			.page()
			.$(this.configService.get<string>('parser.selectors.feedSwitcher'))

		if (!feedSelector) {
			return false
		}

		await feedSelector.click()

		const targetSource = await this.frame
			.page()
			.$(
				`${this.configService.get<string>(
					'parser.selectors.feedSourceSwitcherItem',
				)}[data-id="${messageType}"]`,
			)

		if (!targetSource) {
			return false
		}

		await targetSource.click()
		await sleep(2000)

		if (messageType === 'chat' && chatId) {
			const chatTargetSource = await this.frame
				.page()
				.$(
					this.configService.get<string>(
						'parser.selectors.chatTargetSource',
					),
				)

			if (chatTargetSource) {
				await chatTargetSource.click()
				await sleep(5000)
				await this.frame
					.page()
					.waitForSelector(
						'.users-select-suggest .users-select-row__inner',
					)
				await this.frame
					.page()
					.waitForSelector(
						`${this.configService.get<string>(
							'parser.selectors.chatSourceItem',
						)}[data-id="${chatId}"]`,
					)

				const chatContactSource = await this.frame
					.page()
					.$(
						`${this.configService.get<string>(
							'parser.selectors.chatSourceItem',
						)}[data-id="${chatId}"]`,
					)

				if (!chatContactSource) return false

				await chatContactSource.click()
				await sleep(2000)
			}
		}

		const field = await this.frame
			.page()
			.$(
				`${this.configService.get<string>(
					'parser.selectors.feedSendField',
				)}`,
			)

		if (field) {
			await field.click()
			await sleep(1000)
			const fieldMessage = await this.frame
				.page()
				.$(
					`${this.configService.get<string>(
						'parser.selectors.feedFieldMessage',
					)}`,
				)
			const sendMessageBtn = await this.frame
				.page()
				.$(
					`${this.configService.get<string>(
						'parser.selectors.feedSendBtn',
					)}`,
				)

			if (fieldMessage && sendMessageBtn) {
				await fieldMessage.click({ count: 3 })
				await fieldMessage.type(message, { delay: 10 })
				await sendMessageBtn.click()
				await sleep(5000)

				return true

				// return await page.evaluate((feedSendField: string) => {
				// 	const lastFeed = document.querySelectorAll('')
				// }, this.configService.get<string>('parser.selectors.feedSendField'))
			}
		}
	}

	private async parseLeadSources() {
		const availableSources = await this.frame
			.page()
			.$$eval(
				this.configService.get<string>(
					'parser.selectors.feedSourceSwitcher',
				),
				(elements) => elements.map((el) => el.getAttribute('data-id')),
			)

		if (availableSources.length === 0) {
			return {}
		}

		let chatSources = []
		if (availableSources.find((source) => source === 'chat')) {
			const feedSelector = await this.frame
				.page()
				.$(
					this.configService.get<string>(
						'parser.selectors.feedSwitcher',
					),
				)

			if (!feedSelector) {
				return false
			}

			await feedSelector.click()

			const targetSource = await this.frame
				.page()
				.$(
					`${this.configService.get<string>(
						'parser.selectors.feedSourceSwitcherItem',
					)}[data-id="chat"]`,
				)

			if (!targetSource) {
				return false
			}

			await targetSource.click()
			await sleep(2000)

			const chatTargetSource = await this.frame
				.page()
				.$(
					this.configService.get<string>(
						'parser.selectors.chatTargetSource',
					),
				)

			if (chatTargetSource) {
				await chatTargetSource.click()
				await sleep(5000)
				await this.frame
					.page()
					.waitForSelector(
						'.users-select-suggest .users-select-row__inner',
					)
				chatSources = await this.frame
					.page()
					.$$eval(
						`${this.configService.get<string>(
							'parser.selectors.chatSourceItem',
						)}[data-group="external"]`,
						(elements) =>
							elements.map((el) => el.getAttribute('data-id')),
					)
			}
		}

		return {
			availableSources,
			chat: chatSources,
		}
	}

	private async getPuppeteer(): Promise<PuppeteerExtra> {
		const puppeteer = (await import('puppeteer-extra')).default
		const StealthPlugin = (await import('puppeteer-extra-plugin-stealth'))
			.default
		const AdBlockerPlugin = (
			await import('puppeteer-extra-plugin-adblocker')
		).default
		const RecaptchaPlugin = (
			await import('puppeteer-extra-plugin-recaptcha')
		).default

		const stealthPlugin = StealthPlugin()

		stealthPlugin.enabledEvasions.delete('iframe.contentWindow')
		stealthPlugin.enabledEvasions.delete('media.codecs')

		puppeteer.use(stealthPlugin)
		puppeteer.use(AdBlockerPlugin({ blockTrackers: true }))
		puppeteer.use(
			RecaptchaPlugin({
				provider: {
					id: configuration().captcha.id,
					token: configuration().captcha.token,
				},
				visualFeedback: true,
			}),
		)

		return puppeteer
	}

	private async sendResult(data: any): Promise<void> {
		if (!isEmpty(this.configService.get<string>('sendEndpoint'))) {
			this.logger.log('Sending results...')
			const response = await axios.post(
				this.configService.get<string>('sendEndpoint'),
				data,
			)

			this.logger.log(`Get response: ${JSON.stringify(response.data)}`)
		}
	}

	async getLeadSources(leadId: string) {
		try {
			const cluster = await Cluster.launch({
				concurrency: Cluster.CONCURRENCY_CONTEXT,
				maxConcurrency: 2,
				puppeteer: await this.getPuppeteer(),
				puppeteerOptions: this.configService.get('parser.launch'),
				retryLimit: 3,
				retryDelay: 5,
				timeout: this.timeout,
			})

			const url = `${this.configService.get<string>(
				'parser.protocol',
			)}://${this.configService.get<string>(
				'amo.crm',
			)}.${this.configService.get<string>(
				'parser.domain',
			)}/leads/detail/${leadId}`

			await cluster.task(async ({ page, data: { url } }) => {
				await this.applyDefaultActions(page)

				await this.frame.page().goto(url, {
					waitUntil: 'networkidle0',
					timeout: this.timeout,
				})

				await sleep(3000)

				if (this.isAuth) {
					await this.frame.waitForNavigation({
						waitUntil: 'networkidle0',
						timeout: this.timeout,
					})
				}

				await this.frame
					.page()
					.waitForSelector(
						this.configService.get<string>(
							'parser.selectors.feedsContainer',
						),
					)

				this.amoUsersIds = await this.parseAmoChatConstantUserIds()

				return await this.parseLeadSources()
			})

			cluster.on('taskerror', async (err, data, willRetry) => {
				if (willRetry) {
					this.logger.warn(
						`Encountered an error while crawling ${data}. ${err.message}\\nThis job will be retried`,
					)
				} else {
					const error = `Failed to crawl ${data}: ${err.message}`
					this.logger.error(error)
					await this.sendResult({
						leadId,
						task: 'getLeadSources',
						error,
					})
				}
			})

			const result = (await cluster.execute({
				url,
			})) as IAmoLeadResponse

			await cluster.idle()
			await cluster.close()

			await this.sendResult({
				leadId,
				task: 'getLeadSources',
				result,
			})

			return result
		} catch (e) {
			await this.sendResult({
				leadId,
				task: 'getLeadSources',
				error: (e as Error).message,
			})
			throw new BadRequestException((e as Error).message)
		}
	}

	async getLead(leadId: string): Promise<IAmoLeadResponse> {
		try {
			const cluster = await Cluster.launch({
				concurrency: Cluster.CONCURRENCY_CONTEXT,
				maxConcurrency: 2,
				puppeteer: await this.getPuppeteer(),
				puppeteerOptions: this.configService.get('parser.launch'),
				retryLimit: 3,
				retryDelay: 5,
				timeout: this.timeout,
			})

			const url = `${this.configService.get<string>(
				'parser.protocol',
			)}://${this.configService.get<string>(
				'amo.crm',
			)}.${this.configService.get<string>(
				'parser.domain',
			)}/leads/detail/${leadId}`

			await cluster.task(async ({ page, data: url }) => {
				await this.applyDefaultActions(page)

				await this.frame.page().goto(url, {
					waitUntil: 'networkidle0',
					timeout: this.timeout,
				})

				await sleep(3000)

				if (this.isAuth) {
					await this.frame.waitForNavigation({
						waitUntil: 'networkidle0',
						timeout: this.timeout,
					})
				}

				await this.frame
					.page()
					.waitForSelector(
						this.configService.get<string>(
							'parser.selectors.feedsContainer',
						),
					)
				await this.scrollToStartLead()
				this.amoUsersIds = await this.parseAmoChatConstantUserIds()
				await this.expandFeeds()
				await this.expandMessages()

				const fieldsList = await this.parseMainFields()
				const companyFieldsList = await this.parseCompanyFields()
				const contactsFieldsList = await this.parseContactFields()
				const messageList = await this.parseMessages()

				return {
					ids: this.amoUsersIds,
					fields: fieldsList,
					contacts: contactsFieldsList,
					company: companyFieldsList,
					messages: messageList,
				} as IAmoLeadResponse
			})

			cluster.on('taskerror', async (err, data, willRetry) => {
				if (willRetry) {
					const error = `Encountered an error while crawling ${data}. ${err.message}\\nThis job will be retried`
					this.logger.warn(error)
					// throw new Error(error)
				} else {
					const error = `Failed to crawl ${data}: ${err.message}`
					this.logger.error(error)
					// throw new Error(error)
					await this.sendResult({
						leadId,
						task: 'getLead',
						error,
					})
				}
			})

			const result = (await cluster.execute(url)) as IAmoLeadResponse

			await cluster.idle()
			await cluster.close()

			await this.sendResult({
				leadId,
				task: 'getLead',
				result,
			})

			return result
		} catch (e) {
			await this.sendResult({
				leadId,
				task: 'getLead',
				error: (e as Error).message,
			})
		}
	}

	async sendMessage(
		leadId: string,
		message: string,
		messageType: SendMessageType,
		chatId?: string,
	): Promise<IAmoLeadResponse> {
		try {
			const cluster = await Cluster.launch({
				concurrency: Cluster.CONCURRENCY_CONTEXT,
				maxConcurrency: 2,
				puppeteer: await this.getPuppeteer(),
				puppeteerOptions: this.configService.get('parser.launch'),
				retryLimit: 3,
				retryDelay: 5,
				timeout: this.timeout,
			})

			const url = `${this.configService.get<string>(
				'parser.protocol',
			)}://${this.configService.get<string>(
				'amo.crm',
			)}.${this.configService.get<string>(
				'parser.domain',
			)}/leads/detail/${leadId}`

			await cluster.task(
				async ({
					page,
					data: { url, message, messageType, chatId },
				}) => {
					await this.applyDefaultActions(page)

					await this.frame.page().goto(url, {
						waitUntil: 'networkidle0',
						timeout: this.timeout,
					})

					await sleep(3000)

					if (this.isAuth) {
						await this.frame.waitForNavigation({
							waitUntil: 'networkidle0',
							timeout: this.timeout,
						})
					}

					await this.frame
						.page()
						.waitForSelector(
							this.configService.get<string>(
								'parser.selectors.feedsContainer',
							),
						)
					this.amoUsersIds = await this.parseAmoChatConstantUserIds()
					await this.expandFeeds()
					const sendMessageResult = await this.sendMessageToLead(
						this.frame.page(),
						message,
						messageType,
						chatId,
					)

					if (!sendMessageResult) {
						return {
							ids: this.amoUsersIds,
							messages: [],
						} as IAmoLeadResponse
					}

					const messageList = await this.parseMessages(true)

					return {
						ids: this.amoUsersIds,
						messages: messageList,
					} as IAmoLeadResponse
				},
			)

			cluster.on('taskerror', async (err, data, willRetry) => {
				if (willRetry) {
					this.logger.warn(
						`Encountered an error while crawling ${data}. ${err.message}\\nThis job will be retried`,
					)
				} else {
					const error = `Failed to crawl ${data}: ${err.message}`
					this.logger.error(error)
					await this.sendResult({
						leadId,
						task: 'sendMessage',
						error,
					})
				}
			})

			const result = (await cluster.execute({
				url,
				message,
				messageType,
				chatId,
			})) as IAmoLeadResponse

			await cluster.idle()
			await cluster.close()

			await this.sendResult({
				leadId,
				messageType,
				chatId,
				task: 'sendMessage',
				result,
			})

			return result
		} catch (e) {
			await this.sendResult({
				leadId,
				task: 'sendMessage',
				error: (e as Error).message,
			})
			throw new BadRequestException((e as Error).message)
		}
	}
}
