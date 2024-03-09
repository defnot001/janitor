import { pathToFileURL } from 'bun';
import { glob } from 'glob';
import {
  ApplicationCommandDataResolvable,
  Client,
  ClientEvents,
  ClientOptions,
  Collection,
} from 'discord.js';
import { ClientStartOptions, CommandOptions, RegisterCommandOptions } from '../types';
import { Event } from './Event';
import { LOGGER } from '../..';

export class ExtendedClient extends Client {
  public commands: Collection<string, CommandOptions> = new Collection();

  constructor(options: ClientOptions) {
    super(options);
  }

  public async start(options: ClientStartOptions) {
    const { botToken, guildID, commandsPath, eventsPath, globalCommands, registerCommands } =
      options;

    await this.setModules(commandsPath, eventsPath);

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

  private async setModules(commandsPath: string, eventsPath: string) {
    const commandPaths: string[] = await glob.glob(`${commandsPath.toString()}/*{.ts,.js}`);

    for await (const path of commandPaths) {
      const fileURL = pathToFileURL(path);
      const command: CommandOptions = await this.importFile(fileURL.toString());

      if (!command.name) {
        throw new Error(`Command at path ${path} is missing the name property.`);
      }

      this.commands.set(command.name, command);
    }

    const eventPaths: string[] = await glob.glob(`${eventsPath.toString()}/*{.ts,.js}`);

    for await (const path of eventPaths) {
      const fileURL = pathToFileURL(path);
      const event: Event<keyof ClientEvents> = await this.importFile(fileURL.toString());

      this.on(event.name, event.execute);
    }
  }

  private async importFile(filePath: string) {
    const file = await import(filePath);
    return file.default;
  }
}
