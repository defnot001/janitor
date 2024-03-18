import {
	type APIEmbed,
	EmbedBuilder,
	type EmbedData,
	type Guild,
	type TextChannel,
	type User,
	inlineCode,
	time,
} from 'discord.js';
import {
	type DbServerConfig,
	displayActionLevel,
} from '../database/model/ServerConfigModelController';
import type { ExtendedInteraction } from '../handler/types';
import type { BroadcastType } from './broadcast';
import { displayUserFormatted } from './discord';

export class InfoEmbedBuilder extends EmbedBuilder {
	constructor(user: User, data?: EmbedData | APIEmbed) {
		super(data);

		this.setColor(3_517_048);

		this.setFooter({
			text: `Requested by ${user.username}`,
			iconURL: user.displayAvatarURL(),
		});

		this.setTimestamp(Date.now());
	}
}

export function getBroadcastEmbedColor(broadcastType: BroadcastType) {
	if (broadcastType === 'report' || broadcastType === 'reactivate') {
		return 16_711_680; // red
	}

	if (broadcastType === 'update_explanation' || broadcastType === 'replace_screenshot') {
		return 16_776_960; // yellow
	}

	return 6_684_416; // green
}

export function buildServerConfigEmbed(options: {
	interaction: ExtendedInteraction;
	guild: Guild;
	users: User[];
	dbServerConfig: DbServerConfig;
	logChannel: TextChannel | null;
}) {
	const { interaction, guild, users, dbServerConfig, logChannel } = options;

	const embed = new InfoEmbedBuilder(interaction.user, {
		title: `Server Config for ${guild.name}`,
		fields: [
			{
				name: 'Server ID',
				value: inlineCode(guild.id),
			},
			{
				name: 'Whitelisted Admins',
				value: users.map((user) => displayUserFormatted(user)).join('\n'),
			},
			{
				name: 'Log Channel',
				value: logChannel ? `${logChannel.name} (${inlineCode(logChannel.id)})` : 'Not set',
			},
			{
				name: 'Ping Admins',
				value: dbServerConfig.ping_users ? 'Enabled' : 'Disabled',
			},
			{
				name: 'Ping Role',
				value: dbServerConfig.ping_role ? `<@&${dbServerConfig.ping_role}>` : 'Not set',
			},
			{
				name: 'Spam Action Level',
				value: displayActionLevel(dbServerConfig.spam_action_level),
			},
			{
				name: 'Impersonation Action Level',
				value: displayActionLevel(dbServerConfig.impersonation_action_level),
			},
			{
				name: 'Bigotry Action Level',
				value: displayActionLevel(dbServerConfig.bigotry_action_level),
			},
			{
				name: 'Timeout Users With Role',
				value: dbServerConfig.timeout_users_with_role ? 'Enabled' : 'Disabled',
			},
			{
				name: 'Ignored Roles',
				value: dbServerConfig.ignored_roles.length
					? dbServerConfig.ignored_roles.map((role) => `<@&${role}>`).join(', ')
					: 'None',
			},
			{
				name: 'Created At',
				value: `${time(new Date(dbServerConfig.created_at), 'D')}\n(${time(
					new Date(dbServerConfig.created_at),
					'R',
				)})`,
				inline: true,
			},
			{
				name: 'Updated At',
				value: `${time(new Date(dbServerConfig.updated_at), 'D')}\n(${time(
					new Date(dbServerConfig.updated_at),
					'R',
				)})`,
				inline: true,
			},
		],
	});

	if (guild.iconURL()) {
		embed.setThumbnail(guild.iconURL());
	}

	return embed;
}
