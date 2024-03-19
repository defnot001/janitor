import path from 'node:path';
import {
	type APIEmbedField,
	ApplicationCommandOptionType,
	type Attachment,
	AttachmentBuilder,
	type ButtonInteraction,
	EmbedBuilder,
	type Guild,
	type Snowflake,
	type User,
	inlineCode,
	time,
	userMention,
} from 'discord.js';
import { botConfig, projectPaths } from '../config';
import {
	BadActorModelController,
	type DbBadActor,
} from '../database/model/BadActorModelController';
import { Command } from '../handler/classes/Command';
import type { ExtendedClient } from '../handler/classes/ExtendedClient';
import type { ExtendedInteraction } from '../handler/types';
import { Screenshot } from '../util/attachments';
import { type BroadcastType, Broadcaster } from '../util/broadcast';
import { InfoEmbedBuilder, getBroadcastEmbedColor } from '../util/builders';
import { getButtonCollector, getConfirmCancelRow } from '../util/discord';
import { LOGGER } from '../util/logger';
import { checkUserInDatabase } from '../util/permission';
import { display, displayDateTimeFormatted, displayFormatted } from '../util/format';

export type BadActorSubcommand =
	| 'report'
	| 'deactivate'
	| 'reactivate'
	| 'display_latest'
	| 'display_by_user'
	| 'display_by_id'
	| 'add_screenshot'
	| 'replace_screenshot'
	| 'update_explanation';

const commandName = 'badactor';

export default new Command({
	name: commandName,
	description: 'Report a bad actor to the TMC admins or remove a report',
	options: [
		{
			name: 'report',
			description: 'Report a user for being naughty',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'user',
					description: 'The user to report. You can also paste their ID here.',
					type: ApplicationCommandOptionType.User,
					required: true,
				},
				{
					name: 'type',
					description: 'The type of bad act the user did',
					type: ApplicationCommandOptionType.String,
					choices: [
						{ name: 'Spam', value: 'spam' },
						{ name: 'Impersonation', value: 'impersonation' },
						{ name: 'Bigotry', value: 'bigotry' },
					],
					required: true,
				},
				{
					name: 'screenshot',
					description: 'A screenshot of the bad act. You can upload a file here.',
					type: ApplicationCommandOptionType.Attachment,
				},
				{
					name: 'explanation',
					description: "If you can't provide a screenshot, please explain what happened here.",
					type: ApplicationCommandOptionType.String,
				},
			],
		},
		{
			name: 'deactivate',
			description: 'Deactivate a user from the bad actor list',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'id',
					description: 'The Database ID of bad actor entry to deactivate',
					type: ApplicationCommandOptionType.Integer,
					required: true,
				},
				{
					name: 'reason',
					description: 'The reason for deactivating the report',
					type: ApplicationCommandOptionType.String,
					required: true,
				},
			],
		},
		{
			name: 'reactivate',
			description: 'Reactivate a user on the bad actor list',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'id',
					description: 'The Database ID of bad actor entry to reactivate',
					type: ApplicationCommandOptionType.Integer,
					required: true,
				},
				{
					name: 'reason',
					description: 'The reason for reactivating the report',
					type: ApplicationCommandOptionType.String,
					required: true,
				},
			],
		},
		{
			name: 'add_screenshot',
			description: "Add a screenshot to an existing report that doesn't have one yet",
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'id',
					description: 'The Database ID of the bad actor entry to add the screenshot to',
					type: ApplicationCommandOptionType.Integer,
					required: true,
				},
				{
					name: 'screenshot',
					description: 'The screenshot to add to the report',
					type: ApplicationCommandOptionType.Attachment,
					required: true,
				},
			],
		},
		{
			name: 'replace_screenshot',
			description:
				'Update the screenshot of an existing report. This will replace and remove the old one.',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'id',
					description: 'The Database ID of the bad actor entry to update the screenshot of',
					type: ApplicationCommandOptionType.Integer,
					required: true,
				},
				{
					name: 'screenshot',
					description: 'The new screenshot to add to the report',
					type: ApplicationCommandOptionType.Attachment,
					required: true,
				},
			],
		},
		{
			name: 'update_explanation',
			description: 'Add an explanation to an existing report or update the existing one',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'id',
					description: 'The Database ID of the bad actor entry to update the explanation ofs',
					type: ApplicationCommandOptionType.Integer,
					required: true,
				},
				{
					name: 'explanation',
					description: 'The explanation to add to the report',
					type: ApplicationCommandOptionType.String,
					required: true,
				},
			],
		},
		{
			name: 'display_latest',
			description: 'Display the latest bad actors',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'amount',
					description: 'The amount of bad actors to display. Default 5. Max 10.',
					type: ApplicationCommandOptionType.Integer,
				},
			],
		},
		{
			name: 'display_by_user',
			description: 'Display all entries from a user',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'user',
					description: 'The user to display the entries from. You can also paste their ID here.',
					type: ApplicationCommandOptionType.User,
					required: true,
				},
			],
		},
		{
			name: 'display_by_id',
			description: 'Display an entry by its Database ID',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'id',
					description: 'The Database ID of the entry to display',
					type: ApplicationCommandOptionType.Integer,
					required: true,
				},
			],
		},
	],
	execute: async ({ interaction, args, client }) => {
		await interaction.deferReply();

		const ctx = await checkUserInDatabase({ interaction, commandName });
		if (!ctx) return;

		if (ctx.guild.id === botConfig.adminServerID) {
			await interaction.editReply('This command is not available in the admin server.');
			return;
		}

		const subcommand = args.getSubcommand() as BadActorSubcommand;

		const commandHandler = new BadActorCommandHandler({
			guild: ctx.guild,
			interaction,
			client,
			subcommand,
		});

		if (subcommand === 'display_latest') {
			const amount = args.getInteger('amount', false) ?? 5;

			if (amount < 1 || amount > 10) {
				await interaction.editReply('The amount must be between 1 and 10.');
				return;
			}

			commandHandler.handleDisplayLatest({ amount });
			return;
		}

		if (subcommand === 'display_by_user') {
			await commandHandler.handleDisplayByUser({ user: args.getUser('user') });
			return;
		}

		if (subcommand === 'display_by_id') {
			await commandHandler.handleDisplayById({ id: args.getInteger('id', true) });
			return;
		}

		if (ctx.dbUser.user_type !== 'reporter') {
			await interaction.editReply('You are not allowed create or edit reports.');
			await LOGGER.warn(
				`${display(interaction.user)} attempted to use /${commandName} ${subcommand} in ${display(
					ctx.guild,
				)} but they are only whitelisted as a listener.`,
			);
			return;
		}

		if (subcommand === 'report') {
			const badActorUser = args.getUser('user');
			const badActorType = args.getString('type');
			const attachment = args.getAttachment('screenshot', false);
			const explanation = args.getString('explanation', false);

			if (!badActorUser) {
				await interaction.editReply(
					'Cannot find this user. You either made a typo or the user does not exist (anymore).',
				);
				await LOGGER.warn(
					`${display(interaction.user)} attempted to use /${commandName} ${subcommand} in ${display(
						ctx.guild,
					)} but did not provide a valid user.`,
				);
				return;
			}

			if (!badActorType || !['spam', 'impersonation', 'bigotry'].includes(badActorType)) {
				await interaction.editReply('You must provide a valid type of bad behaviour.');
				await LOGGER.warn(
					`${display(interaction.user)} attempted to use /${commandName} ${subcommand} in ${display(
						ctx.guild,
					)} but did not provide a valid bad actor type.`,
				);
				return;
			}

			await commandHandler.handleReport({
				badActorUser,
				badActorType: badActorType as BadActorType,
				attachment,
				explanation,
			});
			return;
		}

		if (subcommand === 'deactivate') {
			const id = args.getInteger('id', true);
			const reason = args.getString('reason', true);

			if (!reason.trim().length) {
				await interaction.editReply('You must provide a reason for deactivating the report.');
				await LOGGER.warn(
					`${display(interaction.user)} attempted to deactivate report ${id} in ${display(
						ctx.guild,
					)} without providing a reason.`,
				);
				return;
			}

			await commandHandler.handleDeactivate({ databaseID: id, reason });
			return;
		}

		if (subcommand === 'reactivate') {
			const id = args.getInteger('id', true);
			const reason = args.getString('reason', true);

			if (!reason.trim().length) {
				await interaction.editReply('You must provide a reason for deactivating the report.');
				await LOGGER.warn(
					`${display(interaction.user)} attempted to deactivate report ${id} in ${display(
						ctx.guild,
					)} without providing a reason.`,
				);
				return;
			}

			await commandHandler.handleReactivate({ databaseID: id, reason });
			return;
		}

		if (subcommand === 'add_screenshot') {
			const id = args.getInteger('id', true);
			const attachment = args.getAttachment('screenshot', true);

			await commandHandler.handleAddScreenshot({ databaseID: id, attachment });
			return;
		}

		if (subcommand === 'replace_screenshot') {
			const id = args.getInteger('id', true);
			const attachment = args.getAttachment('screenshot', true);

			await commandHandler.handleReplaceScreenshot({ databaseID: id, attachment });
			return;
		}

		if (subcommand === 'update_explanation') {
			const id = args.getInteger('id', true);
			const explanation = args.getString('explanation', true);

			if (!explanation.trim().length) {
				await interaction.editReply('You must provide an explanation.');
				return;
			}

			await commandHandler.handleUpdateExplanation({ databaseID: id, explanation });
			return;
		}
	},
});

class BadActorCommandHandler {
	private readonly interaction: ExtendedInteraction;
	private readonly client: ExtendedClient;
	private readonly guild: Guild;
	private readonly subcommand: BadActorSubcommand;

	public constructor(options: {
		interaction: ExtendedInteraction;
		client: ExtendedClient;
		guild: Guild;
		subcommand: BadActorSubcommand;
	}) {
		this.interaction = options.interaction;
		this.client = options.client;
		this.guild = options.guild;
		this.subcommand = options.subcommand;
	}

	public async handleDisplayLatest(args: { amount: number }): Promise<void> {
		const badActors = await BadActorModelController.getBadActors(args.amount).catch(async (e) => {
			await LOGGER.error(`Failed to get bad actors from the database: ${e}`);
			return null;
		});

		if (!badActors) {
			await this.interaction.editReply('Failed to get bad actors from the database.');
			return;
		}

		if (badActors.length === 0) {
			await this.interaction.editReply('There are no bad actors in the database.');
			await LOGGER.warn(
				`User ${display(this.interaction.user)} attempted to use /${commandName} ${
					this.subcommand
				} in ${display(this.guild)} but there are no bad actors in the database.`,
			);
			return;
		}

		await this.sendBadActorEmbeds(badActors);
	}

	public async handleDisplayByUser(args: { user: User | null }): Promise<void> {
		if (!args.user) {
			await this.interaction.editReply(
				'Cannot find this user. You either made a typo or the user does not exist (anymore).',
			);
			await LOGGER.warn(
				`${display(this.interaction.user)} attempted to use /${commandName} ${
					this.subcommand
				} in ${display(this.guild)} but did not provide a valid user.`,
			);
			return;
		}

		const badActors = await BadActorModelController.getBadActorsBySnowflake(args.user.id).catch(
			async (e) => {
				await LOGGER.error(`Failed to get bad actors from the database: ${e}`);
				return null;
			},
		);

		if (!badActors) {
			await this.interaction.editReply('Failed to get bad actors from the database.');
			return;
		}

		if (badActors.length === 0) {
			await this.interaction.editReply(`${displayFormatted(args.user)} has no entries.`);
			return;
		}

		if (badActors.length > 10) {
			await this.interaction.editReply(
				`${displayFormatted(args.user)} has too many entries to display.`,
			);
			return;
		}

		await this.sendBadActorEmbeds(badActors);
	}

	public async handleDisplayById(args: { id: number }): Promise<void> {
		const badActor = await BadActorModelController.getBadActorById(args.id).catch(async (e) => {
			await LOGGER.error(`Failed to get the bad actor from the database: ${e}`);
			return null;
		});

		if (!badActor) {
			await this.interaction.editReply('This entry does not exist.');
			await LOGGER.warn(
				`User ${display(this.interaction.user)} attempted to use /${commandName} ${
					this.subcommand
				} in ${display(this.guild)} to display the entry ID ${
					args.id
				} but this entry does not exist.`,
			);
			return;
		}

		await this.sendBadActorEmbeds([badActor]);
	}

	public async handleReport(args: {
		badActorUser: User;
		badActorType: BadActorType;
		attachment: Attachment | null;
		explanation: string | null;
	}): Promise<void> {
		const { badActorUser, badActorType, attachment, explanation } = args;

		const activeCase = await this.getActiveCase(badActorUser);

		if (activeCase) {
			await LOGGER.warn(
				`User ${display(this.interaction.user)} attempted to report user ${display(
					badActorUser,
				)} in ${display(this.guild)} but this user already has an active case.`,
			);
			await this.sendBadActorEmbeds([activeCase], 'This user already has an active case.');
			return;
		}

		if (!attachment && !explanation) {
			await this.interaction.editReply('You must provide a screenshot or an explanation.');
			await LOGGER.warn(
				`${display(this.interaction.user)} attempted to use /${commandName} ${
					this.subcommand
				} in ${display(this.guild)} but did not provide a screenshot or an explanation.`,
			);
			return;
		}

		const badActorUserEmbed = this.buildBadActorUserEmbed(this.interaction.user, badActorUser);

		await this.interaction.editReply({
			content: 'Is this the user you want to report?',
			embeds: [badActorUserEmbed],
			components: [getConfirmCancelRow()],
		});

		const collector = getButtonCollector(this.interaction);

		if (!collector) {
			await this.interaction.editReply('Failed to create a button collector. Aborting report.');
			await LOGGER.error(
				`Failed to create a button collector for /${commandName} ${this.subcommand}.`,
			);
			return;
		}

		collector.on('collect', async (buttonInteraction) => {
			await this.handleReportButtonCollect({
				attachment,
				badActorUser,
				badActorType,
				buttonInteraction,
				explanation,
			});
		});
	}
	public async handleDeactivate(args: { databaseID: number; reason: string }) {
		const dbBadActor = await this.getBadActor(args.databaseID);
		if (!dbBadActor) return;

		if (!dbBadActor.is_active) {
			await this.interaction.editReply('This entry is already deactivated.');
			await LOGGER.warn(
				`User ${display(this.interaction.user)} attempted to deactivate bad actor ${
					args.databaseID
				} in ${display(this.guild)} but this entry is already deactivated.`,
			);
			return;
		}

		const deactivatedBadActor = await BadActorModelController.deactivateBadActor({
			id: args.databaseID,
			explanation: args.reason,
			last_changed_by: this.interaction.user.id,
		}).catch(async (e) => {
			await LOGGER.error(`Failed to deactivate the entry with ID ${args.databaseID}: ${e}`);
			return null;
		});

		if (!deactivatedBadActor) {
			await this.interaction.editReply('Failed to deactivate the entry.');
			return;
		}

		LOGGER.info(
			`${display(this.interaction.user)} deactivated bad actor ${args.databaseID} in ${display(
				this.guild,
			)}.`,
		);

		await this.sendBadActorEmbeds([deactivatedBadActor], 'This entry has been deactivated.');

		await Broadcaster.broadcast({
			client: this.client,
			broadcastType: 'deactivate',
			dbBadActor: deactivatedBadActor,
		});
	}
	public async handleReactivate(args: { databaseID: number; reason: string }) {
		const dbBadActor = await this.getBadActor(args.databaseID);
		if (!dbBadActor) return;

		if (dbBadActor.is_active) {
			await this.interaction.editReply('This entry is already activated.');
			await LOGGER.warn(
				`User ${display(this.interaction.user)} attempted to reactivate bad actor ${
					args.databaseID
				} in ${display(this.guild)} but this entry is already activated.`,
			);
			return;
		}

		const reactivatedBadActor = await BadActorModelController.reactivateBadActor({
			id: args.databaseID,
			explanation: args.reason,
			last_changed_by: this.interaction.user.id,
		}).catch(async (e) => {
			await LOGGER.error(`Failed to reactivate the entry with ID ${args.databaseID}: ${e}`);
			return null;
		});

		if (!reactivatedBadActor) {
			await this.interaction.editReply('Failed to reactivate the entry.');
			return;
		}

		LOGGER.info(
			`${displayFormatted(this.interaction.user)} reactivated bad actor ${
				args.databaseID
			} in ${display(this.guild)}.`,
		);

		await this.sendBadActorEmbeds([reactivatedBadActor], 'This entry has been reactivated.');

		await Broadcaster.broadcast({
			client: this.client,
			broadcastType: 'reactivate',
			dbBadActor: reactivatedBadActor,
		});
	}
	public async handleAddScreenshot(args: { databaseID: number; attachment: Attachment }) {
		const dbBadActor = await this.getBadActor(args.databaseID);
		if (!dbBadActor) return;

		if (!dbBadActor.is_active) {
			await this.interaction.editReply(
				'This entry is deactivated. You cannot add a screenshot to it.',
			);
			return;
		}

		if (dbBadActor.screenshot_proof) {
			await this.interaction.editReply(
				'This entry already has a screenshot. If you want to replace it, use the /badactor replace_screenshot command.',
			);
			return;
		}

		const screenshotPath = await this.saveScreenshot({
			attachment: args.attachment,
			badActorID: dbBadActor.user_id,
		});

		if (!screenshotPath) return;

		const updatedBadActor = await BadActorModelController.updateScreenshotProof(
			args.databaseID,
			screenshotPath,
			this.interaction.user.id,
		).catch(async (e) => {
			await LOGGER.error(
				`Failed to update the screenshot for entry with ID ${args.databaseID}: ${e}`,
			);
			return null;
		});

		if (!updatedBadActor) {
			await this.interaction.editReply('Failed to update the screenshot.');
			return;
		}

		LOGGER.info(
			`${displayFormatted(this.interaction.user)} added a screenshot to bad actor ${
				args.databaseID
			} in ${display(this.guild)}.`,
		);

		await this.sendBadActorEmbeds([updatedBadActor], 'The screenshot has been added.');

		await Broadcaster.broadcast({
			client: this.client,
			broadcastType: 'add_screenshot',
			dbBadActor: updatedBadActor,
		});
	}
	public async handleReplaceScreenshot(args: { databaseID: number; attachment: Attachment }) {
		const dbBadActor = await this.getBadActor(args.databaseID);
		if (!dbBadActor) return;

		if (!dbBadActor.is_active) {
			await this.interaction.editReply(
				'This entry is deactivated. You cannot add a screenshot to it.',
			);
			return;
		}

		if (!dbBadActor.screenshot_proof) {
			await this.interaction.editReply(
				'This entry does not have a screenshot yet. Please use the /badactor add_screenshot instead.',
			);
			return;
		}

		let screenshotPath: string | null = null;

		try {
			const screenshot = new Screenshot(args.attachment, dbBadActor.user_id);
			await screenshot.replaceFileInFileSystem(dbBadActor.screenshot_proof);

			screenshotPath = screenshot.path;
		} catch (e) {
			await this.interaction.editReply('Failed to save screenshot.');
			await LOGGER.error(`Failed to save screenshot: ${e}`);
			return;
		}

		if (!screenshotPath) return;

		const updatedBadActor = await BadActorModelController.updateScreenshotProof(
			args.databaseID,
			screenshotPath,
			this.interaction.user.id,
		).catch(async (e) => {
			await LOGGER.error(
				`Failed to update the screenshot for entry with ID ${args.databaseID}: ${e}`,
			);
			return null;
		});

		if (!updatedBadActor) {
			await this.interaction.editReply('Failed to update the screenshot.');
			return;
		}

		LOGGER.info(
			`${display(this.interaction.user)} replaced the screenshot for bad actor with ID ${
				args.databaseID
			} in ${display(this.guild)}.`,
		);

		await this.sendBadActorEmbeds([updatedBadActor], 'The screenshot has been replaced.');

		await Broadcaster.broadcast({
			client: this.client,
			broadcastType: 'replace_screenshot',
			dbBadActor: updatedBadActor,
		});
	}
	public async handleUpdateExplanation(args: { databaseID: number; explanation: string }) {
		const dbBadActor = await this.getBadActor(args.databaseID);
		if (!dbBadActor) return;

		if (!dbBadActor.is_active) {
			await this.interaction.editReply(
				'This entry is deactivated. You cannot add an explanation to it.',
			);
			return;
		}

		const updatedBadActor = await BadActorModelController.updateExplanation(
			args.databaseID,
			args.explanation,
			this.interaction.user.id,
		).catch(async (e) => {
			await LOGGER.error(
				`Failed to update the explanation for entry with ID ${args.databaseID}: ${e}`,
			);
			return null;
		});

		if (!updatedBadActor) {
			await this.interaction.editReply('Failed to update the explanation.');
			return;
		}

		LOGGER.info(
			`${display(this.interaction.user)} added or updated an explanation to bad actor ${
				args.databaseID
			} in ${display(this.guild)}.`,
		);

		await this.sendBadActorEmbeds([updatedBadActor], 'The explanation has been added or updated.');

		await Broadcaster.broadcast({
			client: this.client,
			broadcastType: 'update_explanation',
			dbBadActor: updatedBadActor,
		});
	}

	private async sendBadActorEmbeds(badActors: DbBadActor[], message?: string): Promise<void> {
		const badActorEmbedPromises = badActors.map((badActor) =>
			buildBadActorEmbed({ dbBadActor: badActor, client: this.client }),
		);

		try {
			const badActorEmbeds = await Promise.all(badActorEmbedPromises);

			const embeds = badActorEmbeds.map(({ embed }) => embed);
			const notNullAttachments = badActorEmbeds
				.map(({ attachment }) => attachment)
				.filter((a) => a !== null) as AttachmentBuilder[];

			if (message && message.length > 0) {
				await this.interaction.editReply({ content: message, embeds, files: notNullAttachments });
			} else {
				await this.interaction.editReply({ embeds, files: notNullAttachments });
			}
		} catch (e) {
			await this.interaction.editReply('Failed to send the bad actor embed.');
			await LOGGER.error(`Failed to send the bad actor embed: ${e}`);
		}
	}

	private async getActiveCase(user: User): Promise<DbBadActor | null> {
		try {
			return await BadActorModelController.hasBadActorActiveCase(user.id);
		} catch (e) {
			await this.interaction.editReply(
				`Failed to get the active case for ${displayFormatted(user)} from the database.`,
			);
			await LOGGER.error(
				`Failed to get the active case for ${display(user)} from the database: ${e}`,
			);
			return null;
		}
	}

	private buildBadActorUserEmbed(interactionUser: User, targetUser: User) {
		return new InfoEmbedBuilder(interactionUser, {
			title: `Info User ${targetUser.globalName ?? targetUser.username}`,
			thumbnail: {
				url: targetUser.displayAvatarURL(),
			},
			fields: [
				{ name: 'ID', value: inlineCode(targetUser.id) },
				{
					name: 'Created At',
					value: `${time(new Date(targetUser.createdAt), 'D')}\n(${time(
						new Date(targetUser.createdAt),
						'R',
					)})`,
				},
			],
		});
	}

	private async handleReportButtonCollect(options: {
		buttonInteraction: ButtonInteraction;
		attachment: Attachment | null;
		badActorUser: User;
		badActorType: BadActorType;
		explanation: string | null;
	}) {
		const { buttonInteraction, attachment, badActorUser, badActorType, explanation } = options;

		if (buttonInteraction.customId === 'confirm') {
			await this.interaction.editReply({
				content: 'Reporting user to the community and taking action...',
				components: [],
				embeds: [],
			});

			await this.reportBadActor({
				badActorUser,
				badActorType,
				attachment,
				explanation,
			});
		}
		if (buttonInteraction.customId === 'cancel') {
			await this.interaction.editReply({
				content: 'Cancelled the report.',
				components: [],
				embeds: [],
			});
		}
	}

	private async reportBadActor(options: {
		badActorUser: User;
		badActorType: BadActorType;
		attachment: Attachment | null;
		explanation: string | null;
	}) {
		const { badActorUser, badActorType, attachment, explanation } = options;

		const screenshotPath = attachment
			? await this.saveScreenshot({ attachment, badActorID: badActorUser.id })
			: null;

		const dbBadActor = await BadActorModelController.createBadActor({
			actor_type: badActorType,
			user_id: badActorUser.id,
			last_changed_by: this.interaction.user.id,
			originally_created_in: this.guild.id,
			screenshot_proof: screenshotPath,
			explanation: explanation ?? null,
		}).catch(async (e) => {
			await LOGGER.error(
				`Failed to create a bad actor entry for ${display(badActorUser)} in the database: ${e}`,
			);
		});

		if (!dbBadActor) {
			await this.interaction.editReply(
				`Failed to create a bad actor entry for ${displayFormatted(badActorUser)} in the database.`,
			);
			return;
		}

		LOGGER.info(
			`User ${display(this.interaction.user)} reported user ${display(
				badActorUser,
			)} as a bad actor in ${display(this.guild)}.`,
		);

		await Broadcaster.broadcast({
			client: this.client,
			broadcastType: 'report',
			dbBadActor,
		});

		await this.sendBadActorEmbeds([dbBadActor], 'The user has been reported as a bad actor.');
	}

	private async saveScreenshot(options: {
		attachment: Attachment;
		badActorID: Snowflake;
	}): Promise<string | null> {
		const { attachment, badActorID } = options;

		try {
			const screenshot = new Screenshot(attachment, badActorID);
			await screenshot.saveToFileSystem();
			return screenshot.path;
		} catch (e) {
			await this.interaction.editReply('Failed to save screenshot.');
			await LOGGER.error(`Failed to save screenshot: ${e}`);
			return null;
		}
	}

	private async getBadActor(databaseID: number): Promise<DbBadActor | null> {
		try {
			return await BadActorModelController.getBadActorById(databaseID);
		} catch (e) {
			await this.interaction.editReply('This entry does not exist.');
			await LOGGER.error(`Failed to get the bad actor from the database: ${e}`);
			return null;
		}
	}
}

export async function buildBadActorEmbed(options: {
	dbBadActor: DbBadActor;
	client: ExtendedClient;
	broadcastType?: BroadcastType;
}) {
	const { dbBadActor, client } = options;

	const badActorUser = await client.users.fetch(dbBadActor.user_id).catch(async () => {
		await LOGGER.warn(
			`Failed to fetch user ${inlineCode(dbBadActor.user_id)} user for embed creation.`,
		);
		return null;
	});

	const creationGuild = await client.guilds
		.fetch(dbBadActor.originally_created_in)
		.catch(async () => {
			await LOGGER.warn(
				`Failed to fetch guild ${inlineCode(dbBadActor.originally_created_in)} for embed creation.`,
			);
			return null;
		});

	const displayCreationGuild = creationGuild
		? displayFormatted(creationGuild)
		: inlineCode(dbBadActor.originally_created_in);

	const embedTitle =
		badActorUser === null
			? `Bad Actor ${dbBadActor.id}`
			: `Bad Actor ${badActorUser.globalName ?? badActorUser.username}`;

	const embedDescription =
		badActorUser === null
			? 'Discord user cannot be found. They might have been deleted by Discord.'
			: '';

	const embedFields: APIEmbedField[] = [
		{ name: 'Database Entry ID', value: inlineCode(dbBadActor.id.toString()) },
		{ name: 'User ID', value: inlineCode(dbBadActor.user_id) },
		{ name: 'Active', value: dbBadActor.is_active ? 'Yes' : 'No' },
		{ name: 'Type', value: dbBadActor.actor_type },
		{
			name: 'Explanation/Reason',
			value: dbBadActor.explanation ?? 'No explanation provided.',
		},
		{
			name: 'Server of Origin',
			value: displayCreationGuild,
		},
		{
			name: 'Created At',
			value: displayDateTimeFormatted(new Date(dbBadActor.created_at)),
		},
		{
			name: 'Last Updated At',
			value: displayDateTimeFormatted(new Date(dbBadActor.updated_at)),
		},
		{
			name: 'Last Updated By',
			value: `${userMention(dbBadActor.last_changed_by)} (${inlineCode(
				dbBadActor.last_changed_by,
			)})`,
		},
	];

	const embedColor = options.broadcastType
		? getBroadcastEmbedColor(options.broadcastType)
		: 3_517_048;

	const embed = new EmbedBuilder({
		title: embedTitle,
		description: embedDescription,
		fields: embedFields,
		color: embedColor,
		timestamp: new Date(),
		footer: {
			text: 'TMC Janitor Broadcast',
			iconURL: client.user?.displayAvatarURL(),
		},
	});

	if (badActorUser) {
		embed.setThumbnail(badActorUser.displayAvatarURL());
	}

	let attachment: AttachmentBuilder | null = null;

	if (dbBadActor.screenshot_proof) {
		try {
			attachment = new AttachmentBuilder(
				path.join(projectPaths.sources, '..', 'screenshots', dbBadActor.screenshot_proof),
			);
		} catch (e) {
			await LOGGER.error(`Failed to create attachment for bad actor ${dbBadActor.id}: ${e}`);
		}
	}

	if (attachment) {
		embed.setImage(`attachment://${dbBadActor.screenshot_proof}`);
	}

	return { embed, attachment } as const;
}

export type BadActorType = 'spam' | 'impersonation' | 'bigotry';
