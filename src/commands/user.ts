import {
	ApplicationCommandOptionType,
	type CommandInteractionOptionResolver,
	type Guild,
	type Snowflake,
	type User,
	inlineCode,
	time,
} from 'discord.js';
import { ServerConfigModelController } from '../database/model/ServerConfigModelController';
import {
	type DbUser,
	UserModelController,
	type UserType,
} from '../database/model/UserModelController';
import { Command } from '../handler/classes/Command';
import type { ExtendedClient } from '../handler/classes/ExtendedClient';
import type { ExtendedInteraction } from '../handler/types';
import { InfoEmbedBuilder } from '../util/builders';
import { getGuildMap, getUserMap } from '../util/discord';
import { display, displayFormatted } from '../util/format';
import { LOGGER } from '../util/logger';
import { checkAdminInDatabase, isInteractionInAdminServer } from '../util/permission';

const commandName = 'user';

export default new Command({
	name: commandName,
	description: 'Subcommands for managing users.',
	options: [
		{
			name: 'add',
			description: 'Add a user to the whitelist.',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'user',
					description: 'The user to add to the whitelist.',
					type: ApplicationCommandOptionType.User,
					required: true,
				},
				{
					name: 'server_id',
					description:
						'Server(s) for bot usage, separated by commas. Admin server always included.',
					type: ApplicationCommandOptionType.String,
					required: true,
				},
				{
					name: 'user_type',
					description: 'Wether the user can only receive reports or also create them.',
					type: ApplicationCommandOptionType.String,
					choices: [
						{
							name: 'reporter',
							value: 'reporter',
						},
						{
							name: 'listener',
							value: 'listener',
						},
					],
					required: true,
				},
			],
		},
		{
			name: 'list',
			description: 'List all users on the whitelist.',
			type: ApplicationCommandOptionType.Subcommand,
		},
		{
			name: 'info',
			description: 'Get information about a user on the whitelist.',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'user',
					description: 'The user to get information about.',
					type: ApplicationCommandOptionType.User,
					required: true,
				},
			],
		},
		{
			name: 'list_by_server',
			description: 'List all users on the whitelist for a specific server.',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'server_id',
					description: 'The server to get users for.',
					type: ApplicationCommandOptionType.String,
					required: true,
				},
			],
		},
		{
			name: 'update',
			description: 'Update a user on the whitelist.',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'user',
					description: 'The user to update.',
					type: ApplicationCommandOptionType.User,
					required: true,
				},
				{
					name: 'server_id',
					description:
						'Server(s) for bot usage, separated by commas. Admin server always included.',
					type: ApplicationCommandOptionType.String,
					required: true,
				},
				{
					name: 'user_type',
					description: 'Wether the user can only receive reports or also create them.',
					type: ApplicationCommandOptionType.String,
					choices: [
						{
							name: 'reporter',
							value: 'reporter',
						},
						{
							name: 'listener',
							value: 'listener',
						},
					],
					required: true,
				},
			],
		},
		{
			name: 'remove',
			description: 'Remove a user from the whitelist.',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'user',
					description: 'The user to remove from the whitelist.',
					type: ApplicationCommandOptionType.User,
					required: true,
				},
			],
		},
	],
	execute: async ({ interaction, args, client }) => {
		await interaction.deferReply();
		if (!(await checkAdminInDatabase({ interaction, commandName }))) return;
		if (!(await isInteractionInAdminServer({ interaction, commandName }))) return;

		const commandHandler = new UserCommandHandler(interaction, client);

		const subcommand = args.getSubcommand() as
			| 'list'
			| 'list_by_server'
			| 'info'
			| 'add'
			| 'update'
			| 'remove';

		if (subcommand === 'list') {
			await commandHandler.handleUserList();
			return;
		}

		if (subcommand === 'list_by_server') {
			await commandHandler.handleUserListByServer({ guildID: args.getString('server_id', true) });
			return;
		}

		const user = args.getUser('user');

		if (!user) {
			await interaction.editReply('User not found.');
			return;
		}

		if (subcommand === 'info') {
			await commandHandler.handleUserInfo({ user });
			return;
		}

		if (subcommand === 'add') {
			const options = await commandHandler.getAddUpdateOptions(args);
			if (!options) return;

			const { guildIDs, userType } = options;
			await commandHandler.handleUserAdd({ user, userType, guildIDs });
			return;
		}

		if (subcommand === 'update') {
			const options = await commandHandler.getAddUpdateOptions(args);
			if (!options) return;

			const { guildIDs, userType } = options;
			await commandHandler.handleUserUpdate({ user, userType, guildIDs });
			return;
		}

		if (subcommand === 'remove') {
			await commandHandler.handleUserDelete({ user });
			return;
		}
	},
});

class UserCommandHandler {
	private readonly interaction: ExtendedInteraction;
	private readonly client: ExtendedClient;

	public constructor(interaction: ExtendedInteraction, client: ExtendedClient) {
		this.interaction = interaction;
		this.client = client;
	}

	public async getAddUpdateOptions(
		args: CommandInteractionOptionResolver,
	): Promise<AddUpdateOptions | null> {
		const guildIDs = args
			.getString('server_id', true)
			.split(',')
			.map((id) => id.trim());

		const userType = args.getString('user_type', true) as UserType;

		if (guildIDs.length === 0) {
			await this.interaction.editReply('No server IDs provided.');
			return null;
		}

		return { guildIDs, userType };
	}

	public async handleUserList() {
		const allUsers = await this.getAllUsers();
		if (allUsers === null) return;

		const uniqueServerIDs = await this.getUniqueServerIDs();
		if (uniqueServerIDs === null) return;

		const userMap = await getUserMap(
			allUsers.map((u) => u.id),
			this.client,
		);

		const guildMap = await getGuildMap(uniqueServerIDs, this.client);
		const userEntries = this.createUserEntries(allUsers, userMap, guildMap);

		const listEmbed = new InfoEmbedBuilder(this.interaction.user, {
			title: 'Whitelisted Users',
			description: userEntries.join('\n\n'),
		});

		await this.interaction.editReply({ embeds: [listEmbed] });
	}

	public async handleUserListByServer(args: { guildID: Snowflake }) {
		const guild = await this.client.guilds.fetch(args.guildID).catch(async (e) => {
			await LOGGER.error(e, `Error fetching guild ${args.guildID}.`);
			return null;
		});

		if (!guild) {
			await this.interaction.editReply(
				`Server ${inlineCode(args.guildID)} not found. The bot may not be in this server.`,
			);
			return;
		}

		const dbUsers = await UserModelController.getUsersByServer(args.guildID).catch(async (e) => {
			await LOGGER.error(e, `Error fetching users by guild with ID ${args.guildID}.`);
			return null;
		});

		if (!dbUsers) {
			await this.interaction.editReply(
				`Error fetching users for server ${displayFormatted(guild)}`,
			);
			return;
		}

		const dbUserIDs = dbUsers.map((u) => u.id);
		const userMap = await getUserMap(dbUserIDs, this.client);

		const userEntries = dbUserIDs.map((id) => {
			const maybeUser = userMap.get(id) ?? null;
			return maybeUser ? displayFormatted(maybeUser) : inlineCode(id);
		});

		const listEmbed = new InfoEmbedBuilder(this.interaction.user, {
			title: `Whitelisted Users for ${displayFormatted(guild)}`,
			description: userEntries.join('\n'),
		});

		await this.interaction.editReply({ embeds: [listEmbed] });
	}

	public async handleUserInfo(args: { user: User }) {
		const dbUser = await UserModelController.getUser(args.user.id).catch(async (e) => {
			await LOGGER.error(e, `Error fetching ${display(args.user)} from the database.`);
			return null;
		});

		if (!dbUser) {
			await this.interaction.editReply(
				`User ${displayFormatted(args.user)} is not on the whitelist.`,
			);
			return;
		}

		const userGuildsMap = await getGuildMap(dbUser.servers, this.client);

		const displayGuilds = dbUser.servers.map((guildID) => {
			const userGuild = userGuildsMap.get(guildID) ?? null;
			return userGuild ? displayFormatted(userGuild) : inlineCode(guildID);
		});

		const infoEmbed = this.createUserEmbed({
			dbUser,
			user: args.user,
			displayGuilds,
		});

		await this.interaction.editReply({ embeds: [infoEmbed] });
	}

	public async handleUserAdd(args: { user: User; userType: UserType; guildIDs: Snowflake[] }) {
		const userGuildsMap = await getGuildMap(args.guildIDs, this.client);
		const checkedGuildMap = await this.checkGuildMap(userGuildsMap);
		if (!checkedGuildMap) return;

		const createdUser = await UserModelController.createUser({
			id: args.user.id,
			servers: args.guildIDs,
			user_type: args.userType,
		}).catch(async (e) => {
			await this.handleCreateUserError(e);
			return null;
		});

		if (!createdUser) return;

		const displayGuilds = args.guildIDs
			// we can safely assume that the guilds are in the map since we checked it
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			.map((guildID) => displayFormatted(checkedGuildMap.get(guildID)!));

		const infoEmbed = this.createUserEmbed({
			dbUser: createdUser,
			user: args.user,
			displayGuilds,
		});

		await this.interaction.editReply({
			content: 'Successfully added user to the database.',
			embeds: [infoEmbed],
		});

		await this.handleServerConfigUpdates({
			newServerIDs: args.guildIDs,
			oldServerIDs: [],
		});
	}

	public async handleUserUpdate(args: { user: User; userType: UserType; guildIDs: Snowflake[] }) {
		const userGuildsMap = await getGuildMap(args.guildIDs, this.client);
		const checkedGuildMap = await this.checkGuildMap(userGuildsMap);
		if (!checkedGuildMap) return;

		const updatedUser = await UserModelController.updateUser({
			id: args.user.id,
			servers: args.guildIDs,
			user_type: args.userType,
		}).catch(async (e) => {
			await LOGGER.error(e, `Error updating ${display(args.user)} in the database.`);
			await this.interaction.editReply(
				'An error occurred while updating the user on the whitelist.',
			);
			return null;
		});

		if (!updatedUser) return;

		const displayGuilds = args.guildIDs
			// we can safely assume that the guilds are in the map since we checked it
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			.map((guildID) => displayFormatted(checkedGuildMap.get(guildID)!));

		const infoEmbed = this.createUserEmbed({
			dbUser: updatedUser,
			user: args.user,
			displayGuilds,
		});

		await this.interaction.editReply({
			content: 'Successfully updated user in the database.',
			embeds: [infoEmbed],
		});

		await this.handleServerConfigUpdates({
			oldServerIDs: updatedUser.servers,
			newServerIDs: args.guildIDs,
		});
	}

	public async handleUserDelete(args: { user: User }) {
		let deletedUser: DbUser | null = null;

		try {
			deletedUser = await UserModelController.deleteUser(args.user.id);
		} catch (e) {
			await LOGGER.error(e, `Error deleting ${display(args.user)} from whitelist.`);
		}

		if (!deletedUser) {
			await this.interaction.editReply(
				'An error occurred while removing the user from the whitelist.',
			);
			return;
		}

		await this.handleServerConfigUpdates({ oldServerIDs: deletedUser.servers, newServerIDs: [] });
	}

	private async getAllUsers(): Promise<DbUser[] | null> {
		let allUsers: DbUser[] | null = null;

		try {
			allUsers = await UserModelController.getAllUsers();
		} catch (e) {
			await LOGGER.error(e, 'Error fetching all users from the database.');
			await this.interaction.editReply('Error fetching all users from the database.');
		}

		if (allUsers === null || allUsers.length === 0) {
			await this.interaction.editReply('No users found.');
			return null;
		}

		return allUsers;
	}

	private async getUniqueServerIDs(): Promise<Snowflake[] | null> {
		let uniqueServerIDs: Snowflake[] | null = null;

		try {
			uniqueServerIDs = await UserModelController.getUniqueServerIDs();
		} catch (e) {
			await LOGGER.error(e, 'Error fetching all unique server IDs from the database.');
			await this.interaction.editReply('Error fetching all server IDs from the database.');
		}

		return uniqueServerIDs;
	}

	private createUserEntries(
		dbUsers: DbUser[],
		userMap: Map<Snowflake, User | null>,
		guildMap: Map<Snowflake, Guild | null>,
	) {
		const entries: string[] = [];

		for (const dbUser of dbUsers) {
			const { id, servers } = dbUser;

			const user = userMap.get(id) ?? null;
			const guilds = servers.map((guildID) => guildMap.get(guildID) ?? guildID);

			const displayUser = user ? displayFormatted(user) : inlineCode(id);
			const displayGuilds = guilds
				.map((guild) => (typeof guild === 'string' ? inlineCode(guild) : displayFormatted(guild)))
				.join(', ');

			entries.push(`${displayUser}\n${displayGuilds}`);
		}

		return entries;
	}

	private createUserEmbed(options: { user: User; dbUser: DbUser; displayGuilds: string[] }) {
		return new InfoEmbedBuilder(this.interaction.user, {
			title: `User Info for ${displayFormatted(options.user)}`,
			fields: [
				{
					name: 'Servers',
					value: options.displayGuilds.join('\n'),
				},
				{
					name: 'Created At',
					value: `${time(options.dbUser.created_at, 'D')}\n(${time(
						options.dbUser.created_at,
						'R',
					)})`,
				},
			],
		});
	}

	private async checkGuildMap(
		guildMap: Map<Snowflake, Guild | null>,
	): Promise<Map<Snowflake, Guild> | null> {
		const failedGuilds = Array.from(guildMap.entries())
			.filter(([, guild]) => guild === null)
			.map(([guildID]) => guildID);

		if (failedGuilds.length > 0) {
			await this.interaction.editReply(
				`Failed to fetch the following servers: ${failedGuilds
					.map((id) => inlineCode(id))
					.join(', ')}. Either the bot is not in these servers or the IDs are incorrect.`,
			);
			return null;
		}

		return guildMap as Map<Snowflake, Guild>;
	}

	private async handleCreateUserError(e: unknown) {
		if (
			e &&
			e !== null &&
			typeof e === 'object' &&
			'message' in e &&
			typeof e.message === 'string' &&
			e.message.includes('duplicate key value violates unique constraint "users_pkey"')
		) {
			this.interaction.editReply('User is already on the whitelist.');
			await LOGGER.warn('User is already on the whitelist.');
		} else {
			this.interaction.editReply('An error occurred while adding the user to the whitelist.');
			await LOGGER.error(e, 'Error adding user to whitelist.');
		}
	}

	private async handleServerConfigUpdates(options: {
		newServerIDs: Snowflake[];
		oldServerIDs: Snowflake[];
	}) {
		const { newServerIDs, oldServerIDs } = options;

		const serversToAdd = newServerIDs.filter((id) => !oldServerIDs.includes(id));
		const serversToRemove = oldServerIDs.filter((id) => !newServerIDs.includes(id));

		serversToAdd.map(async (guildID) => {
			const displayGuild = await this.getDisplayMaybeGuild(guildID);

			const result = await ServerConfigModelController.createServerConfigIfNotExists(guildID).catch(
				async (e) => {
					await LOGGER.error(e, `Error creating server config for ${displayGuild}.`);
					return null;
				},
			);

			if (result === null) {
				LOGGER.debug(`Server config for server ${displayGuild} already exists. Skipping creation.`);
				return;
			}

			const message = `Created empty server config for ${displayGuild}.`;

			LOGGER.info(message);
			await this.interaction.followUp(message);
		});

		serversToRemove.map(async (guildID) => {
			const deleted = await ServerConfigModelController.deleteServerConfigIfNeeded(guildID).catch(
				async (e) => {
					await LOGGER.error(e, `Error deleting server config for ${displayGuild}.`);
					return null;
				},
			);

			const displayGuild = await this.getDisplayMaybeGuild(guildID);

			if (deleted === null) {
				await LOGGER.error(new Error(`Error deleting server config for ${displayGuild}.`));
				return;
			}

			if (deleted === true) {
				const message = `Deleted server config for ${displayGuild} because it's no longer in use.`;

				LOGGER.info(message);
				await this.interaction.followUp(message);
				return;
			}

			LOGGER.debug(`Server config for ${displayGuild} still in use. Skipping deletion.`);
		});
	}

	private async getDisplayMaybeGuild(guildID: Snowflake) {
		return this.client.guilds
			.fetch(guildID)
			.then((guild) => {
				return display(guild);
			})
			.catch((e) => {
				LOGGER.error(e, `Error fetching guild ${guildID}.`);
				return inlineCode(guildID);
			});
	}
}

type AddUpdateOptions = {
	guildIDs: Snowflake[];
	userType: UserType;
};
