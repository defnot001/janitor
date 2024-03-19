import {
	ApplicationCommandOptionType,
	type CommandInteractionOptionResolver,
	type Guild,
	type Snowflake,
	type TextChannel,
	type User,
} from 'discord.js';
import { botConfig } from '../config';
import {
	type CreateServerConfig,
	type DbServerConfig,
	ServerConfigModelController,
} from '../database/model/ServerConfigModelController';
import { UserModelController } from '../database/model/UserModelController';
import { Command } from '../handler/classes/Command';
import type { ExtendedClient } from '../handler/classes/ExtendedClient';
import type { ExtendedInteraction } from '../handler/types';
import { buildServerConfigEmbed } from '../util/builders';
import { getTextChannelByID, getUserMap } from '../util/discord';
import { display, displayFormatted } from '../util/format';
import { LOGGER } from '../util/logger';
import { checkUserInDatabase } from '../util/permission';

const commandName = 'config';

export const config = new Command({
	name: commandName,
	description: 'Configure the bot for your server',
	options: [
		{
			name: 'display',
			description: 'Display the current configuration',
			type: ApplicationCommandOptionType.Subcommand,
		},
		{
			name: 'update',
			description: 'Change the configuration of the bot',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'logchannel',
					description: 'The channel to log actions to',
					type: ApplicationCommandOptionType.Channel,
				},
				{
					name: 'pingusers',
					description: 'Whether or not to ping users when action is taken',
					type: ApplicationCommandOptionType.Boolean,
				},
				{
					name: 'pingrole',
					description: 'The role to ping when actions are taken',
					type: ApplicationCommandOptionType.Role,
				},
				{
					name: 'spam_actionlevel',
					description: 'The level of action to take for spamming users with hacked accounts',
					type: ApplicationCommandOptionType.Integer,
					choices: [
						{
							name: 'Notify',
							value: 0,
						},
						{
							name: 'Timeout',
							value: 1,
						},
						{
							name: 'Kick',
							value: 2,
						},
						{
							name: 'Soft Ban',
							value: 3,
						},
						{
							name: 'Ban',
							value: 4,
						},
					],
				},
				{
					name: 'impersonation_actionlevel',
					description: 'The level of action to take for users impersonating others',
					type: ApplicationCommandOptionType.Integer,
					choices: [
						{
							name: 'Notify',
							value: 0,
						},
						{
							name: 'Timeout',
							value: 1,
						},
						{
							name: 'Kick',
							value: 2,
						},
						{
							name: 'Soft Ban',
							value: 3,
						},
						{
							name: 'Ban',
							value: 4,
						},
					],
				},
				{
					name: 'bigotry_actionlevel',
					description: 'The level of action to take for users using bigoted language',
					type: ApplicationCommandOptionType.Integer,
					choices: [
						{
							name: 'Notify',
							value: 0,
						},
						{
							name: 'Timeout',
							value: 1,
						},
						{
							name: 'Kick',
							value: 2,
						},
						{
							name: 'Soft Ban',
							value: 3,
						},
						{
							name: 'Ban',
							value: 4,
						},
					],
				},
				{
					name: 'timeoutuserswithrole',
					description: 'Whether or not to timeout users with a specific role',
					type: ApplicationCommandOptionType.Boolean,
				},
				{
					name: 'ignoredroles',
					description:
						'Role IDs to ignore when taking action. Separate multiple roles with a comma',
					type: ApplicationCommandOptionType.String,
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

		const commandHandler = new ConfigCommandHandler({
			guild: ctx.guild,
			client,
			interaction,
		});

		const subcommand = args.getSubcommand() as 'display' | 'update';

		if (subcommand === 'display') {
			await commandHandler.handleDisplay();
			return;
		}

		if (subcommand === 'update') {
			await commandHandler.handleUpdate(args);
			return;
		}
	},
});

class ConfigCommandHandler {
	private readonly interaction: ExtendedInteraction;
	private readonly client: ExtendedClient;
	private readonly guild: Guild;
	constructor(options: { interaction: ExtendedInteraction; client: ExtendedClient; guild: Guild }) {
		this.interaction = options.interaction;
		this.client = options.client;
		this.guild = options.guild;
	}

	public async handleDisplay(): Promise<void> {
		let serverConfig: DbServerConfig | null = null;

		try {
			serverConfig = await ServerConfigModelController.getServerConfig(this.guild.id);
		} catch (e) {
			await this.interaction.editReply(
				`Failed to get server configf for ${displayFormatted(this.guild)}`,
			);
			await LOGGER.error(e, `Failed to get server config for ${display(this.guild)}.`);
			return;
		}

		if (!serverConfig) {
			await this.interaction.editReply(
				`Server config not found for ${displayFormatted(this.guild)}`,
			);
			await LOGGER.error(new Error(`Server config not found for ${display(this.guild)}`));
			return;
		}

		const serverUsers = await this.getServerUsers();
		const logChannel = await this.getLogChannel(serverConfig.log_channel);

		const embed = buildServerConfigEmbed({
			interaction: this.interaction,
			dbServerConfig: serverConfig,
			guild: this.guild,
			users: serverUsers,
			logChannel,
		});

		await this.interaction.editReply({ embeds: [embed] });
	}
	public async handleUpdate(args: CommandInteractionOptionResolver): Promise<void> {
		const updateOptions = this.getUpdateOptions(args);

		try {
			const serverConfig = await ServerConfigModelController.updateServerConfig(updateOptions);

			if (!serverConfig) {
				await this.interaction.editReply('Server config not found.');
				return;
			}

			const logChannel = await this.getLogChannel(serverConfig.log_channel);
			const serverUsers = await this.getServerUsers();

			const embed = buildServerConfigEmbed({
				interaction: this.interaction,
				dbServerConfig: serverConfig,
				guild: this.guild,
				users: serverUsers,
				logChannel,
			});

			await this.interaction.editReply({ content: 'Updated Serverconfig', embeds: [embed] });
		} catch (e) {
			await this.interaction.editReply('Failed to update server config.');
			await LOGGER.error(e, `Failed to update server config for ${display(this.guild)}.`);
		}
	}

	private async getLogChannel(channelID: Snowflake | null): Promise<TextChannel | null> {
		return channelID ? await getTextChannelByID(this.client, channelID) : null;
	}

	private async getServerUsers(): Promise<User[]> {
		try {
			const users = await UserModelController.getUsersByServer(this.guild.id);

			try {
				const userMap = await getUserMap(
					users.map((user) => user.id),
					this.client,
				);

				return Array.from(userMap.values()).filter((user) => user !== null) as User[];
			} catch (e) {
				await LOGGER.error(
					e,
					`Failed to fetch discord users from ID to create a serverconfig embed for ${display(
						this.guild,
					)}.`,
				);
				return [];
			}
		} catch (e) {
			await LOGGER.error(e, `Failed to get users for ${display(this.guild)} from the database.`);
			return [];
		}
	}

	private getUpdateOptions(args: CommandInteractionOptionResolver): CreateServerConfig {
		const logChannel = args.getChannel('logchannel');
		const pingUsers = args.getBoolean('pingusers');
		const pingRole = args.getRole('pingrole');
		const spamActionLevel = args.getInteger('spam_actionlevel');
		const impersonationActionLevel = args.getInteger('impersonation_actionlevel');
		const bigotryActionLevel = args.getInteger('bigotry_actionlevel');
		const timeoutUsersWithRole = args.getBoolean('timeoutuserswithrole');
		const ignoredRoles =
			args
				.getString('ignoredroles')
				?.split(',')
				.map((id) => id.trim()) ?? [];

		return {
			server_id: this.guild.id,
			log_channel: logChannel?.id,
			ping_users: pingUsers,
			ping_role: pingRole?.id,
			spam_action_level: spamActionLevel,
			impersonation_action_level: impersonationActionLevel,
			bigotry_action_level: bigotryActionLevel,
			timeout_users_with_role: timeoutUsersWithRole,
			ignored_roles: ignoredRoles,
		};
	}
}
