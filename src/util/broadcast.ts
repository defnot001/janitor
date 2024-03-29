import {
	type AttachmentBuilder,
	type Client,
	Collection,
	type EmbedBuilder,
	type Guild,
	type GuildMember,
	PermissionFlagsBits,
	type Role,
	type Snowflake,
	TextChannel,
	type User,
	escapeMarkdown,
	inlineCode,
	userMention,
} from 'discord.js';
import { type BadActorSubcommand, buildBadActorEmbed } from '../commands/badActor';
import { botConfig } from '../config';
import type { DbBadActor } from '../database/model/BadActorModelController';
import {
	ActionLevel,
	type ServerConfig,
	ServerConfigModelController,
} from '../database/model/ServerConfigModelController';
import { UserModelController } from '../database/model/UserModelController';
import type { ExtendedClient } from '../handler/classes/ExtendedClient';
import { getGuildMember, getTextChannelByID } from './discord';
import { display, displayFormatted } from './format';
import { LOGGER } from './logger';
export type BroadcastType = Exclude<
	BadActorSubcommand,
	'display_latest' | 'display_by_user' | 'display_by_id'
>;

type ModerationAction = 'none' | 'timeout' | 'kick' | 'softban' | 'ban';

export abstract class Broadcaster {
	public static async broadcast(options: {
		client: ExtendedClient;
		dbBadActor: DbBadActor;
		broadcastType: BroadcastType;
	}) {
		const { client, dbBadActor, broadcastType } = options;
		const listenersMap = await Broadcaster.getListenersMap(client);

		const serverChannelIDs = Array.from(listenersMap.values()).map((c) => {
			// We can use type assertion here, because we excluded all servers without a log_channel in getListenersMap()
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			return { guildID: c.server_id, channelID: c.log_channel! };
		});

		const { embed, attachment } = await buildBadActorEmbed({
			client,
			dbBadActor,
			broadcastType,
		});

		const validLogChannels = await Broadcaster.getValidLogChannels(client, serverChannelIDs);
		const notificationMessage = Broadcaster.getNotificationMessage(broadcastType);

		try {
			await Broadcaster.broadcastToAdminServer({
				embed,
				attachment,
				notificationMessage,
				client,
			});
		} catch (e) {
			await LOGGER.error(e, 'Failed to broadcast to admin server.');
		}

		try {
			await Broadcaster.broadcastToServers({
				attachment,
				embed,
				validLogChannels,
				notificationMessage,
				listenersMap,
			});
		} catch (e) {
			await LOGGER.error(e, 'Failed to broadcast to servers.');
		}

		if (broadcastType === 'report') {
			await Broadcaster.takeModerationAction({
				client,
				dbBadActor,
				validLogChannels,
				listenersMap,
			});
		}
	}

	private static async takeModerationAction(options: {
		client: Client;
		dbBadActor: DbBadActor;
		validLogChannels: { guild: Guild; logChannel: TextChannel }[];
		listenersMap: Map<Snowflake, ServerConfig>;
	}) {
		const { client, dbBadActor, validLogChannels } = options;

		// Fetch the user object of the bad actor
		const badActorUser = await client.users.fetch(dbBadActor.user_id).catch(() => null);

		if (!badActorUser) {
			await LOGGER.error(
				new Error(
					`Failed to fetch user ${dbBadActor.user_id} to take moderation action. Skipping all moderation action.`,
				),
			);

			await Promise.all(
				validLogChannels.map((c) =>
					c.logChannel.send(
						'Failed to fetch user to take moderation action. If your server has automatic moderation actions, they will not be performed.',
					),
				),
			);

			return;
		}

		const handleModeration = async (logChannel: TextChannel, guild: Guild): Promise<void> => {
			const serverConfig = options.listenersMap.get(guild.id);

			if (!serverConfig) {
				await LOGGER.error(
					new Error(
						`Failed to get server config for server ${guild.name} ${inlineCode(
							guild.id,
						)}. Skipping their server.`,
					),
				);
				return;
			}

			const actionToPerform = await Broadcaster.getActionToPerform(dbBadActor, serverConfig, guild);

			const targetMember = await getGuildMember({
				client,
				guild,
				user: badActorUser,
			});

			const targetMemberRoles = Broadcaster.getMemberRolesWithoutIgnoredRoles(
				targetMember,
				serverConfig.ignored_roles,
			);

			const mod = new GuildModerator({
				guild,
				targetUser: badActorUser,
				dbBadActor,
				channel: logChannel,
			});

			// If the user is not a member of the server, we can only perform a preban
			if (actionToPerform === 'ban' && !targetMember) {
				await mod.ban();
				return;
			}

			// from now on, we need the member object and we have to return if it's not there
			if (!targetMember) {
				await logChannel.send(
					`User ${escapeMarkdown(badActorUser.globalName ?? badActorUser.username)} (${inlineCode(
						badActorUser.id,
					)}) is not a member of your server. Only bans can be performed on users that are not server members but your server doesn't have banning enabled. Skipping all moderation actions.`,
				);
				return;
			}

			// If the uer has roles that are not ignored, we can only perform a timeout or nothing at all.
			if (targetMemberRoles.size > 0) {
				// If the server has the option to timeout users with roles, we can perform a timeout. Else we don't do anything.
				if (serverConfig.timeout_users_with_role) {
					await mod.timeout(targetMember, targetMemberRoles);
				} else {
					await logChannel.send(
						`User ${escapeMarkdown(badActorUser.globalName ?? badActorUser.username)} (${inlineCode(
							badActorUser.id,
						)}) has roles that are not ignored. Those roles are: ${targetMemberRoles
							.map((r) => r.name)
							.join(', ')}. Skipping all moderation actions.`,
					);
				}

				return;
			}

			// at this point, we know that the user has no roles that are not ignored so we can perform any action
			switch (actionToPerform) {
				case 'timeout':
					await mod.timeout(targetMember);
					return;
				case 'kick':
					await mod.kick(targetMember);
					return;
				case 'softban':
					await mod.softban(targetMember);
					return;
				case 'ban':
					await mod.ban();
					return;
				default:
					await logChannel.send(
						`No moderation action set for ${dbBadActor.actor_type}. No actions will be taken.`,
					);
			}

			// if we reach this point, we have no action to perform. This should never happen.
			await logChannel.send(
				`No moderation action set for ${dbBadActor.actor_type}. No actions will be taken.`,
			);
		};

		await Promise.all(validLogChannels.map((c) => handleModeration(c.logChannel, c.guild)));
	}

	private static async getActionToPerform(
		dbBadActor: DbBadActor,
		serverConfig: ServerConfig,
		guild: Guild,
	): Promise<ModerationAction> {
		const actionLevel = Broadcaster.getActionLevel(dbBadActor, serverConfig);
		const logStatementFail = `Failed to get action level for bad actor ${dbBadActor.actor_type} in server config for ${guild.name} (${guild.id}).`;

		if (actionLevel === null) {
			await LOGGER.warn(logStatementFail);
			return 'none';
		}

		switch (actionLevel) {
			case ActionLevel.Notify:
				return 'none';
			case ActionLevel.Timeout:
				return 'timeout';
			case ActionLevel.Kick:
				return 'kick';
			case ActionLevel.SoftBan:
				return 'softban';
			case ActionLevel.Ban:
				return 'ban';
			default:
				await LOGGER.warn(logStatementFail);
				return 'none';
		}
	}

	private static getActionLevel(
		dbBadActor: DbBadActor,
		serverConfig: ServerConfig,
	): ActionLevel | null {
		switch (dbBadActor.actor_type) {
			case 'spam':
				return serverConfig.spam_action_level;
			case 'impersonation':
				return serverConfig.impersonation_action_level;
			case 'bigotry':
				return serverConfig.bigotry_action_level;
			default:
				return null;
		}
	}

	private static async broadcastToAdminServer(options: {
		embed: EmbedBuilder;
		attachment: AttachmentBuilder | null;
		notificationMessage: string;
		client: Client;
	}) {
		const logChannel = await getTextChannelByID(options.client, botConfig.adminServerLogChannel);
		if (!logChannel) return;

		if (options.attachment !== null) {
			await logChannel.send({
				content: options.notificationMessage,
				embeds: [options.embed],
				files: [options.attachment],
			});
			return;
		}

		await logChannel.send({ content: options.notificationMessage, embeds: [options.embed] });
	}

	private static async broadcastToServers(options: {
		embed: EmbedBuilder;
		attachment: AttachmentBuilder | null;
		validLogChannels: { guild: Guild; logChannel: TextChannel }[];
		notificationMessage: string;
		listenersMap: Map<Snowflake, ServerConfig>;
	}) {
		const promises = [];

		for (const { guild, logChannel } of options.validLogChannels) {
			const serverConfig = options.listenersMap.get(guild.id);

			if (!serverConfig) {
				await LOGGER.error(
					new Error(
						`Failed to get server config for server ${guild.name} (${guild.id}). Skipping their server.`,
					),
				);
				continue;
			}

			let messageContent = options.notificationMessage;

			if (serverConfig.ping_users === true) {
				messageContent += `\n${serverConfig.userIDs.map((u) => userMention(u)).join(' ')}`;
			}

			if (serverConfig.ping_role) {
				messageContent += `\n<@&${serverConfig.ping_role}>`;
			}

			if (options.attachment !== null) {
				promises.push(
					logChannel.send({
						content: messageContent,
						embeds: [options.embed],
						files: [options.attachment],
					}),
				);
				continue;
			}

			promises.push(logChannel.send({ content: messageContent, embeds: [options.embed] }));
		}

		await Promise.allSettled(promises);
	}

	private static async getListenersMap(client: Client): Promise<Map<Snowflake, ServerConfig>> {
		const serverConfigs = await ServerConfigModelController.getAllServerConfigs();
		const configMap: Map<Snowflake, ServerConfig> = new Map();

		for await (const config of serverConfigs) {
			if (!config.log_channel) {
				await LOGGER.warn(
					`No logchannel set for server ${config.server_id}. Skipping their for broadcasting.`,
				);
				continue;
			}

			try {
				const users = await UserModelController.getUsersByServer(config.server_id);
				const serverconfig: ServerConfig = { ...config, userIDs: users.map((user) => user.id) };
				configMap.set(config.server_id, serverconfig);
			} catch (e) {
				try {
					const guild = await client.guilds.fetch(config.server_id);

					await LOGGER.error(
						e,
						`Failed to get users for server ${display(guild)} (${
							config.server_id
						}). Skipping their server.`,
					);
				} catch (e) {
					await LOGGER.error(
						e,
						`Failed to get users for server ${config.server_id}. Skipping their server.`,
					);
				}
			}
		}

		return configMap;
	}

	private static async getValidLogChannels(
		client: Client,
		serverChannelIDs: {
			guildID: Snowflake;
			channelID: Snowflake;
		}[],
	) {
		const validLogChannels: { guild: Guild; logChannel: TextChannel }[] = [];

		for (const { guildID, channelID } of serverChannelIDs) {
			const guild = await client.guilds.fetch(guildID).catch(async (e) => {
				await LOGGER.error(e, `Failed to fetch server ${guildID}, skipping this server.`);
				return null;
			});

			if (!guild) {
				continue;
			}

			try {
				const channel = await client.channels.fetch(channelID);

				if (channel?.isTextBased() && channel instanceof TextChannel) {
					try {
						const clientUser = await client.user;

						if (!clientUser) {
							throw new Error('Client user not found.');
						}

						const botMember = await guild.members.fetch(clientUser.id);

						if (!botMember) {
							throw new Error('Bot member not found.');
						}

						const requiredPermissions = [
							PermissionFlagsBits.ViewChannel,
							PermissionFlagsBits.SendMessages,
							PermissionFlagsBits.EmbedLinks,
							PermissionFlagsBits.AttachFiles,
						];

						const missingPermissions = channel
							.permissionsFor(botMember)
							.missing(requiredPermissions);

						if (missingPermissions.length > 0) {
							await LOGGER.error(
								new Error(
									`Bot does not have the required permissions in channel ${display(
										channel,
									)} for server ${display(
										guild,
									)}. The missing permissions are: ${missingPermissions.join(
										', ',
									)}. Skipping server.`,
								),
							);

							continue;
						}
					} catch (e) {
						await LOGGER.error(
							e,
							`Bot does not have access to channel ${display(channel)} for server ${display(
								guild,
							)}. Skipping server.`,
						);
					}

					validLogChannels.push({ guild, logChannel: channel });
				} else {
					await LOGGER.warn(
						`Logchannel ${channelID} for server ${guild.name} is not a text channel. Skipping this channel.`,
					);
				}
			} catch (e) {
				await LOGGER.error(
					e,
					`Failed to fetch channel ${channelID} for server ${display(
						guild,
					)}. Skipping this channel.`,
				);
			}
		}

		return validLogChannels;
	}

	private static getNotificationMessage(broadcastType: BroadcastType) {
		let description: string | null = null;

		switch (broadcastType) {
			case 'report':
				description = 'A bad actor has been reported.';
				break;
			case 'deactivate':
				description = 'A bad actor has been deactivated.';
				break;
			case 'reactivate':
				description = 'A bad actor has been reactivated.';
				break;
			case 'add_screenshot':
				description = 'A screenshot proof has been added to a bad actor entry.';
				break;
			case 'update_explanation':
				description = 'The explanation for a bad actor has been updated.';
				break;
			case 'replace_screenshot':
				description = 'A screenshot has been replaced for a bad actor.';
				break;
			default:
				description = 'Unknown broadcast type.';
		}

		return description;
	}

	private static getMemberRolesWithoutIgnoredRoles(
		member: GuildMember | null,
		ignoredRoles: Snowflake[],
	): Collection<Snowflake, Role> {
		const removed = new Collection<Snowflake, Role>();

		if (!member) {
			return removed;
		}

		for (const [roleID, role] of member.roles.cache) {
			// remove the @everyone role
			if (roleID === member.guild.id) {
				continue;
			}

			if (!ignoredRoles.includes(roleID)) {
				removed.set(roleID, role);
			}
		}

		return removed;
	}
}

class GuildModerator {
	private guild: Guild;
	private targetUser: User;
	private dbBadActor: DbBadActor;
	private channel: TextChannel;
	public constructor(options: {
		guild: Guild;
		targetUser: User;
		dbBadActor: DbBadActor;
		channel: TextChannel;
	}) {
		this.guild = options.guild;
		this.targetUser = options.targetUser;
		this.dbBadActor = options.dbBadActor;
		this.channel = options.channel;
	}

	public async ban() {
		try {
			// await this.guild.members.ban(this.targetUser, {
			//   reason: this.getReason(),
			//   deleteMessageSeconds: 604800,
			// });

			LOGGER.info(`Banned user ${display(this.targetUser)} from server ${display(this.guild)}.`);
		} catch (e) {
			await LOGGER.error(
				e,
				`Failed to ban user ${display(this.targetUser)} from server ${display(this.guild)}.`,
			);

			try {
				await this.channel.send(`Failed to ban user ${displayFormatted(this.targetUser)}.`);
			} catch (e) {
				await LOGGER.error(
					e,
					`Failed to notify server ${display(this.guild)} that there was an error banning ${display(
						this.targetUser,
					)}.`,
				);
			}
		}

		try {
			await this.channel.send(`Banned ${displayFormatted(this.targetUser)} from your server.`);
		} catch (e) {
			await LOGGER.error(
				e,
				`Failed to notify server ${display(this.guild)} that user ${display(
					this.targetUser,
				)} was banned.`,
			);
		}
	}

	public async timeout(targetMember: GuildMember, targetMemberRoles?: Collection<Snowflake, Role>) {
		try {
			// await targetMember.timeout(1000 * 60 * 60 * 24, this.getReason()); // 24 hours
			LOGGER.info(`Timed out user ${display(this.targetUser)} in server ${display(this.guild)}.`);
		} catch (e) {
			await LOGGER.error(
				e,
				`Failed to timeout user ${display(this.targetUser)} in server ${display(this.guild)}.`,
			);

			try {
				await this.channel.send(`Failed to timeout user ${displayFormatted(this.targetUser)}.`);
			} catch (e) {
				await LOGGER.error(
					e,
					`Failed to notify server ${display(
						this.guild,
					)} that there was an error timing out ${display(this.targetUser)}.`,
				);
			}
		}

		try {
			if (targetMemberRoles && targetMemberRoles.size > 0) {
				await this.channel.send(
					`Timed out ${displayFormatted(
						this.targetUser,
					)} for 24 hours, because they have roles that are not ignored. Those roles are: ${targetMemberRoles
						.map((r) => r.name)
						.join(', ')}.`,
				);
			} else {
				await this.channel.send(`Timed out ${displayFormatted(this.targetUser)} for 24 hours.`);
			}
		} catch (e) {
			await LOGGER.error(
				e,
				`Failed to notify server ${display(this.guild)} that user ${display(
					this.targetUser,
				)} was timed out.`,
			);
		}
	}

	public async kick(targetMember: GuildMember) {
		try {
			// await targetMember.kick(this.getReason());
			LOGGER.info(`Kicked user ${display(this.targetUser)} from server ${display(this.guild)}.`);
		} catch (e) {
			await LOGGER.error(
				e,
				`Failed to kick user ${display(this.targetUser)} from server ${display(this.guild)}.`,
			);

			try {
				await this.channel.send(`Failed to kick user ${displayFormatted(this.targetUser)}.`);
			} catch (e) {
				await LOGGER.error(
					e,
					`Failed to notify server ${display(this.guild)} that there was an error kicking ${display(
						this.targetUser,
					)}.`,
				);
			}
		}
	}

	public async softban(targetMember: GuildMember) {
		try {
			// await targetMember.ban({ reason: this.getReason(), deleteMessageSeconds: 604800 });
			// await this.guild.members.unban(this.targetUser, 'Softban');
			LOGGER.info(
				`Softbanned user ${display(this.targetUser)} from server ${display(this.guild)}.`,
			);
		} catch (e) {
			await LOGGER.error(
				e,
				`Failed to softban user ${display(this.targetUser)} from server ${display(this.guild)}.`,
			);

			try {
				await this.channel.send(`Failed to softban user ${displayFormatted(this.targetUser)}.`);
			} catch (e) {
				await LOGGER.error(
					e,
					`Failed to notify server ${display(
						this.guild,
					)} that there was an error softbanning ${display(this.targetUser)}.`,
				);
			}
		}

		try {
			await this.channel.send(`Softbanned ${displayFormatted(this.targetUser)} from your server.`);
		} catch (e) {
			await LOGGER.error(
				e,
				`Failed to notify server ${display(this.guild)} that user ${display(
					this.targetUser,
				)} was softbanned.`,
			);
		}
	}

	private getReason() {
		return `Bad actor ${this.dbBadActor.actor_type} (${this.dbBadActor.id})`;
	}
}
