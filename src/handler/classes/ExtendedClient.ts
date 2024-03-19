import { type ApplicationCommandDataResolvable, Client, Collection } from 'discord.js';
import { LOGGER } from '../../util/logger';
import type { ClientStartOptions, CommandOptions, RegisterCommandOptions } from '../types';
import type { Command } from './Command';

import { adminconfig } from '../../commands/adminconfig';
import { adminlist } from '../../commands/adminlist';
import { badactor } from '../../commands/badActor';
import { config } from '../../commands/config';
import { user } from '../../commands/user';

import { interactionCreate } from '../../events/interactionCreate';
import { ready } from '../../events/ready';

export const COMMANDS: Command[] = [adminconfig, adminlist, badactor, config, user];
export const EVENTS = [interactionCreate, ready];

export class ExtendedClient extends Client {
	public commands: Collection<string, CommandOptions> = new Collection();

	public async start(options: ClientStartOptions) {
		const { botToken, guildID, globalCommands, registerCommands } = options;

		await this.setModules();

		if (registerCommands) {
			const slashCommands: ApplicationCommandDataResolvable[] = this.commands.map(
				(command) => command,
			);

			this.once('ready', () => {
				if (globalCommands) {
					this.registerCommands({
						commands: slashCommands,
					});
				} else {
					this.registerCommands({
						guildID,
						commands: slashCommands,
					});
				}
			});
		}

		await this.login(botToken);
	}

	/**
	 * Removes all the commands from the guild or globally.
	 * If there is no `guildID` being passed, it will remove the global application commands.
	 */
	public async removeCommands(guildID?: string) {
		if (guildID) {
			const guild = this.guilds.cache.get(guildID);

			if (!guild) {
				throw new Error('Cannot find the guild to remove the commands from!');
			}

			await guild.commands.set([]);

			LOGGER.info(`Successfully removed commands from ${guild.name}.`);
		} else {
			if (!this.application) {
				throw new Error('Cannot find the application to remove the commands from!');
			}

			await this.application.commands.set([]);

			LOGGER.info('Successfully removed all commands.');
		}
	}

	private async registerCommands(options: RegisterCommandOptions) {
		const { commands, guildID } = options;

		if (guildID) {
			const guild = this.guilds.cache.get(guildID);

			if (!guild) {
				throw new Error('Cannot find the guild to register the commands to');
			}

			await guild.commands.set(commands);

			LOGGER.info(`Successfully registered ${commands.length} commands to ${guild.name}.`);
		} else {
			if (!this.application) {
				throw new Error('Cannot find the application to register the commands to');
			}

			await this.application.commands.set(commands);

			LOGGER.info(`Successfully registered ${commands.length} global commands.`);
		}
	}

	private async setModules() {
		for (const command of COMMANDS) {
			if (!command.name) {
				throw new Error('Command is missing the name property.');
			}

			this.commands.set(command.name, command);
		}

		for (const event of EVENTS) {
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			this.on(event.name, event.execute as any);
		}
	}
}
