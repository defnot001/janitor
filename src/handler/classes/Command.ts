import type {
	PermissionResolvable,
	ChatInputApplicationCommandData,
	CommandInteractionOptionResolver,
	ApplicationCommandOptionData,
} from 'discord.js';
import type { ExtendedClient } from './ExtendedClient';
import type { CommandOptions, ExtendedInteraction } from '../types';

export class Command implements ChatInputApplicationCommandData {
	name: string;
	description: string;
	options?: readonly ApplicationCommandOptionData[];
	defaultPermission?: boolean;
	userPermissions?: PermissionResolvable;
	execute: (options: {
		client: ExtendedClient;
		interaction: ExtendedInteraction;
		args: CommandInteractionOptionResolver;
	}) => Promise<void>;

	constructor(commandOptions: CommandOptions) {
		this.name = commandOptions.name;
		this.description = commandOptions.description;
		this.options = commandOptions.options;
		this.defaultPermission = commandOptions.defaultPermission;
		this.userPermissions = commandOptions.userPermissions;
		this.execute = commandOptions.execute;
	}
}
