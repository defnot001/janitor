import {
  ApplicationCommandDataResolvable,
  ChatInputApplicationCommandData,
  CommandInteraction,
  CommandInteractionOptionResolver,
  GuildMember,
  PermissionResolvable,
} from 'discord.js';
import { ExtendedClient } from './classes/ExtendedClient';

export type RegisterCommandOptions = {
  guildID?: string;
  commands: ApplicationCommandDataResolvable[];
};

export interface ExtendedInteraction extends CommandInteraction {
  member: GuildMember;
}

export type CommandOptions = {
  userPermissions?: PermissionResolvable;
  execute: (options: {
    client: ExtendedClient;
    interaction: ExtendedInteraction;
    args: CommandInteractionOptionResolver;
  }) => unknown;
} & ChatInputApplicationCommandData;

export type ClientStartOptions = {
  botToken: string;
  guildID: string;
  commandsPath: string;
  eventsPath: string;
  globalCommands: boolean;
  registerCommands: boolean;
};
