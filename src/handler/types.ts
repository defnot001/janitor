import type {
	ApplicationCommandDataResolvable,
	ChatInputApplicationCommandData,
	CommandInteraction,
	CommandInteractionOptionResolver,
	GuildMember,
	PermissionResolvable,
} from 'discord.js';
import type { ExtendedClient } from './classes/ExtendedClient';

export type RegisterCommandOptions = {
	guildID?: string;
	commands: ApplicationCommandDataResolvable[];
};

export interface ExtendedInteraction extends CommandInteraction {
	member: GuildMember;
}

export type CommandOptions = {
	userPermissions?: PermissionResolvable;
	defaultPermission?: boolean;
	execute: (options: {
		client: ExtendedClient;
		interaction: ExtendedInteraction;
		args: CommandInteractionOptionResolver;
	}) => Promise<void>;
} & ChatInputApplicationCommandData;

export type ClientStartOptions = {
	botToken: string;
	guildID?: string;
	globalCommands: boolean;
	registerCommands: boolean;
};
