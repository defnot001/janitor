import { ApplicationCommandOptionType, type Snowflake, type User } from 'discord.js';
import { BadActorModelController } from '../database/model/BadActorModelController';
import {
	type DbServerConfig,
	ServerConfigModelController,
} from '../database/model/ServerConfigModelController';
import { UserModelController } from '../database/model/UserModelController';
import { Command } from '../handler/classes/Command';
import type { ExtendedClient } from '../handler/classes/ExtendedClient';
import type { ExtendedInteraction } from '../handler/types';
import { Screenshot } from '../util/attachments';
import { type InfoEmbedBuilder, buildServerConfigEmbed } from '../util/builders';
import { getTextChannelByID, getUserMap } from '../util/discord';
import { display, displayFormatted } from '../util/format';
import { LOGGER } from '../util/logger';
import { checkAdminInDatabase, isInteractionInAdminServer } from '../util/permission';

const commandName = 'adminconfig';

export default new Command({
	name: commandName,
	description: "Subcommands for admins to inspect the bot's server configs",
	options: [
		{
			name: 'display_configs',
			description: 'Display the server configs for one or multiple servers',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'server',
					description:
						'The ID(s) of the server(s) to display the config for. Separate multiple IDs with a comma (,). Max 5.',
					type: ApplicationCommandOptionType.String,
					required: true,
				},
			],
		},
		{
			name: 'delete_bad_actor',
			description: 'Delete a bad actor from the database',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'id',
					description: 'The ID of the entry to delete',
					type: ApplicationCommandOptionType.Integer,
					required: true,
				},
			],
		},
	],
	execute: async ({ interaction, args, client }) => {
		await interaction.deferReply();
		if (!(await checkAdminInDatabase({ interaction, commandName }))) return;
		if (!(await isInteractionInAdminServer({ interaction, commandName }))) return;

		const subcommand = args.getSubcommand() as 'display_configs' | 'delete_bad_actor';
		const commandHandler = new AdminconfigCommandHandler(interaction, client);

		if (subcommand === 'display_configs') {
			const serverIDs = args
				.getString('server', true)
				.split(',')
				.map((id) => id.trim());

			if (serverIDs.length < 1 || serverIDs.length > 5) {
				await interaction.editReply(
					`Server IDs must be between 1 and 5. You provided ${serverIDs.length}.`,
				);
				return;
			}

			await commandHandler.handleDisplayConfigs({ serverIDs });
			return;
		}

		if (subcommand === 'delete_bad_actor') {
			await commandHandler.handleDeleteBadActor({ entryID: args.getInteger('id', true) });
			return;
		}
	},
});

class AdminconfigCommandHandler {
	private readonly interaction: ExtendedInteraction;
	private readonly client: ExtendedClient;

	public constructor(interaction: ExtendedInteraction, client: ExtendedClient) {
		this.interaction = interaction;
		this.client = client;
	}

	public async handleDisplayConfigs(args: { serverIDs: Snowflake[] }): Promise<void> {
		try {
			const serverConfigs = await ServerConfigModelController.getServerConfigs(args.serverIDs);

			if (!serverConfigs.length) {
				await this.interaction.editReply('No server configs found for the provided server IDs.');
				return;
			}

			const embeds = await this.buildEmbedsFromDbConfigs(serverConfigs);
			await this.interaction.editReply({ embeds });
		} catch (e) {
			await this.interaction.editReply('An error occurred while fetching the server configs.');
			await LOGGER.error(e, 'An error occurred while fetching the server configs.');
			return;
		}
	}

	public async handleDeleteBadActor(args: { entryID: number }): Promise<void> {
		try {
			const dbEntry = await BadActorModelController.getBadActorById(args.entryID);

			if (!dbEntry) {
				await this.interaction.editReply('No bad actor found with the provided ID.');
				return;
			}

			await this.deleteBadActor({ entryID: args.entryID });
		} catch (e) {
			await this.interaction.editReply(
				'An error occurred while getting the bad actor from the database.',
			);
			await LOGGER.error(
				e,
				`An error occurred while getting bad actor with ID ${args.entryID} from the database.`,
			);
			return;
		}
	}

	private async buildEmbedsFromDbConfigs(dbConfigs: DbServerConfig[]): Promise<InfoEmbedBuilder[]> {
		const embeds: InfoEmbedBuilder[] = [];

		for (const dbServerConfig of dbConfigs) {
			try {
				const guild = await this.client.guilds.fetch(dbServerConfig.server_id);
				const configGuildDbUsers = await UserModelController.getUsersByServer(guild.id);
				const logChannel = dbServerConfig.log_channel
					? await getTextChannelByID(this.client, dbServerConfig.log_channel)
					: null;
				const users = await getUserMap(
					configGuildDbUsers.map((user) => user.id),
					this.client,
				);

				const usersWithoutNull = Array.from(users.values()).filter(
					(user) => user !== null,
				) as User[];

				const embed = buildServerConfigEmbed({
					interaction: this.interaction,
					users: usersWithoutNull,
					guild,
					logChannel,
					dbServerConfig,
				});

				embeds.push(embed);
			} catch (e) {
				await LOGGER.error(
					e,
					`An error occurred while fetching information to build a server config embed for ${dbServerConfig.server_id}.`,
				);
				await this.interaction.followUp(
					`Failed to fetch information to build a server config embed for server ID ${dbServerConfig.server_id}.`,
				);
			}
		}

		return embeds;
	}

	private async deleteBadActor(args: { entryID: number }): Promise<void> {
		try {
			const deleted = await BadActorModelController.deleteBadActor(args.entryID);
			const deletedUser = await this.client.users.fetch(deleted.user_id).catch(() => null);

			if (deleted.screenshot_proof) {
				await Screenshot.deleteFromFileSystem(deleted.screenshot_proof);
			}

			await this.interaction.editReply(
				`Bad actor with ${
					deletedUser ? displayFormatted(deletedUser) : deleted.user_id
				} has been deleted from the database.`,
			);

			LOGGER.info(
				`${display(this.interaction.user)} deleted bad actor ${
					deletedUser ? display(deletedUser) : deleted.user_id
				} from the database.`,
			);
		} catch (e) {
			const errorMessage = `An error occurred while deleting bad actor with entry ID ${args.entryID} from the database.`;

			await this.interaction.editReply(errorMessage);
			await LOGGER.error(e, errorMessage);
		}
	}
}
