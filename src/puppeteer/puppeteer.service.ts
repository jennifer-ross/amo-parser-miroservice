import { Injectable } from '@nestjs/common'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import AdBlockerPlugin from 'puppeteer-extra-plugin-adblocker'
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha'
import { Browser, ElementHandle, Page } from 'puppeteer'
import { WorkerPool } from '../worker.pool'
import { ConfigService } from '@nestjs/config'
import * as path from 'path'
import * as fs from 'fs'
import process from 'process'
import { Protocol } from 'devtools-protocol'
import configuration from '../config/configuration'
import { sleep } from '../utils'

puppeteer.use(StealthPlugin())
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

@Injectable()
export class PuppeteerService {
	private cookiePath = path.join(process.cwd(), 'src/puppeteer/cookies.json')

	constructor(
		private readonly workerPool: WorkerPool,
		private readonly configService: ConfigService,
	) {}

	async getEvaluateScript(
		scriptName: string,
		params: {} & any,
	): Promise<string> {
		return (await import(`./evaluate/${scriptName}.js`)).default(
			params,
		) as string
	}

	async loadCookies() {
		if (fs.existsSync(this.cookiePath)) {
			return JSON.parse(fs.readFileSync(this.cookiePath, 'utf8'))
		}

		return {}
	}

	async saveCookies(data: any) {
		return fs.writeFileSync(this.cookiePath, JSON.stringify(data), 'utf8')
	}

	async setCookiesToPage(page: Page): Promise<Page> {
		let cookies = await this.loadCookies()

		const cookieValues = Object.values(
			cookies,
		) as Protocol.Network.CookieParam[]

		await page.setCookie(...cookieValues)

		return page
	}

	async expandFeeds(page: Page): Promise<Page> {
		await page.waitForSelector(
			this.configService.get<string>('parser.selectors.feedsContainer'),
		)
		const expandBtns = await page.$$(
			this.configService.get<string>('parser.selectors.feedExpandBtn'),
		)

		for (const expandBtn of expandBtns) {
			await expandBtn.click({ delay: 30 })
			await sleep(1000)
		}

		return page
	}

	async expandMessages(page: Page): Promise<Page> {
		let moreBtns: ElementHandle<Element>[] = null

		do {
			moreBtns = await page.$$(
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

		return page
	}

	async onLoad(page: Page) {
		const finalCookie = {}
		// session_end_login
		await page.on('load', async () => {
			await this.authorise(page)

			let cookies = await page.cookies()

			cookies.forEach(function (item) {
				finalCookie[item.name] = item
			})

			if (this.configService.get('amo.saveSession')) {
				await this.saveCookies(finalCookie)
			}
		})

		return finalCookie
	}

	async onRequest(page: Page) {
		page.on('request', async (request) => {
			try {
				// Capture any request that is a navigation requests that attempts to load a new document
				// This will capture HTTP Status 301, 302, 303, 307, 308, HTML, and Javascript redirects
				if (
					request.isNavigationRequest() &&
					request.resourceType() === 'document'
				) {
					try {
						page.waitForNavigation({
							waitUntil: 'networkidle0',
							timeout: 0,
						})
					} catch (e) {}
				}
				request.continue()
			} catch (e) {}
		})
	}

	async authorise(page: Page) {
		const authField = await page.$('#session_end_login')
		const passwordField = await page.$('#password')
		const authSubmitBtn = await page.$('#auth_submit')

		if (authField && passwordField && authSubmitBtn) {
			await authField.type(this.configService.get('amo.login'), {
				delay: 120,
			})
			await passwordField.type(this.configService.get('amo.password'), {
				delay: 120,
			})
			await authSubmitBtn.click({ delay: 30 })
			await sleep(2000)
			await page.solveRecaptchas()
		}
	}

	async scrollToStartLead(page: Page) {
		let feedCreated = null

		do {
			feedCreated = page.$(
				`${this.configService.get<string>(
					'parser.selectors.leadCreated',
				)}`,
			)
			try {
				await page.evaluate(
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

	async applyDefaultActions(page: Page) {
		await page.setDefaultNavigationTimeout(0)
		await this.setCookiesToPage(page)
		await this.onLoad(page)
		await this.onRequest(page)
	}

	async getLead(leadId: string) {
		puppeteer
			.launch(this.configService.get('parser.launch'))
			.then(async (browser) => {
				const page = await browser.newPage()

				await this.applyDefaultActions(page)

				const url = `${this.configService.get<string>(
					'parser.protocol',
				)}://${this.configService.get<string>(
					'amo.crm',
				)}.${this.configService.get<string>(
					'parser.domain',
				)}/leads/detail/${leadId}`

				await page.goto(url, {
					waitUntil: 'networkidle0',
					timeout: 0,
				})

				await this.scrollToStartLead(page)
				await this.expandFeeds(page)
				await this.expandMessages(page)

				const messageList = await page.evaluate(
					(
						feedIdAttr: string,
						feedSelector: string,
						feedDateSelector: string,
						messageTextSelector: string,
						messageText2Selector: string,
						messageText3Selector: string,
					) =>
						Array.from(
							document.querySelectorAll(`${feedSelector}`),
							(element) => {
								const feedId = element.getAttribute(
									`${feedIdAttr}`,
								)
								const feedDate = element.querySelector(
									`${feedDateSelector}`,
								)

								let message = element.querySelector(
									`${messageTextSelector}`,
								)

								const messageText = null

								if (!message) {
									message = element.querySelector(
										`${messageText2Selector}`,
									)
								}

								if (!message) {
									message = element.querySelector(
										`${messageText3Selector}`,
									)
								}

								return {
									date: feedDate
										? feedDate.textContent
										: null,
									id: feedId,
									text: message ? message.textContent : null,
								}
							},
						),
					this.configService.get<string>(
						'parser.selectors.feedIdAttr',
					),
					this.configService.get<string>('parser.selectors.feed'),
					this.configService.get<string>('parser.selectors.feedDate'),
					this.configService.get<string>(
						'parser.selectors.messageText',
					),
					this.configService.get<string>(
						'parser.selectors.messageText2',
					),
					this.configService.get<string>(
						'parser.selectors.messageText3',
					),
				)

				await browser.close()
			})
	}
}
