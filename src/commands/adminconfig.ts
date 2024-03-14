import {
  ApplicationCommandOptionType,
  Guild,
  Snowflake,
  TextChannel,
  User,
  inlineCode,
  time,
} from 'discord.js';
import { Command } from '../handler/classes/Command';
import {
  DbServerConfig,
  ServerConfigModelController,
  displayActionLevel,
} from '../database/model/ServerConfigModelController';
import { UserModelController } from '../database/model/UserModelController';
import { InfoEmbedBuilder } from '../util/builders';
import { BadActorModelController, DbBadActor } from '../database/model/BadActorModelController';
import { Screenshot } from '../util/attachments';
import { LOGGER } from '../util/logger';
import { hasAdminPermissions, isInteractionInAdminServer } from '../util/permission';
import { ExtendedInteraction } from '../handler/types';
import { ExtendedClient } from '../handler/classes/ExtendedClient';
import { displayUser, displayUserFormatted } from '../util/discord';
import { getTextChannelByID, getUserMap } from '../util/discord';

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
    if (!(await hasAdminPermissions({ interaction, commandName }))) return;
    if (!(await isInteractionInAdminServer({ interaction, commandName }))) return;

    const subcommand = args.getSubcommand() as 'display_configs' | 'delete_bad_actor';

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

      await handleDisplayConfigs({ interaction, client, args: { serverIDs } });
      return;
    }

    if (subcommand === 'delete_bad_actor') {
      const entryID = args.getInteger('id', true);
      await handleDeleteBadActor({ interaction, client, args: { entryID } });
      return;
    }
  },
});

async function handleDisplayConfigs(options: {
  interaction: ExtendedInteraction;
  client: ExtendedClient;
  args: { serverIDs: Snowflake[] };
}): Promise<void> {
  const { interaction, client, args } = options;

  try {
    const serverConfigs = await ServerConfigModelController.getServerConfigs(args.serverIDs);

    if (!serverConfigs.length) {
      await interaction.editReply('No server configs found for the provided server IDs.');
      return;
    }

    const embeds = await buildEmbedsFromDbConfigs({
      dbConfigs: serverConfigs,
      client,
      interaction,
    });

    await interaction.editReply({ embeds });
  } catch (e) {
    await interaction.editReply('An error occurred while fetching the server configs.');
    await LOGGER.error(`An error occurred while fetching the server configs: ${e}`);
    return;
  }
}

async function handleDeleteBadActor(options: {
  interaction: ExtendedInteraction;
  client: ExtendedClient;
  args: { entryID: number };
}): Promise<void> {
  const { interaction, client, args } = options;

  try {
    const dbEntry = await BadActorModelController.getBadActorById(args.entryID);

    if (!dbEntry) {
      await interaction.editReply('No bad actor found with the provided ID.');
      return;
    }

    await deleteBadActor({ interaction, client, dbEntry, args });
  } catch (e) {
    await interaction.editReply('An error occurred while getting the bad actor from the database.');
    await LOGGER.error(`An error occurred while getting the bad actor from the database: ${e}`);
    return;
  }
}

async function deleteBadActor(options: {
  interaction: ExtendedInteraction;
  client: ExtendedClient;
  dbEntry: DbBadActor;
  args: { entryID: number };
}): Promise<void> {
  const { interaction, client, dbEntry, args } = options;

  try {
    const deleted = await BadActorModelController.deleteBadActor(args.entryID);
    const deletedUser = await client.users.fetch(dbEntry.user_id).catch(() => null);

    if (deleted.screenshot_proof) {
      await Screenshot.deleteFromFileSystem(deleted.screenshot_proof);
    }

    await interaction.editReply(
      `Bad actor with ${deletedUser ? displayUserFormatted(deletedUser) : dbEntry.user_id} has been deleted from the database.`,
    );

    LOGGER.info(
      `${displayUser(interaction.user)} deleted bad actor ${deletedUser ? displayUserFormatted(deletedUser) : dbEntry.user_id} from the database.`,
    );
  } catch (e) {
    await interaction.editReply('An error occurred while deleting the user from the database.');
    await LOGGER.error(`An error occurred while deleting the user from the database: ${e}`);
  }
}

async function buildEmbedsFromDbConfigs(options: {
  dbConfigs: DbServerConfig[];
  client: ExtendedClient;
  interaction: ExtendedInteraction;
}): Promise<InfoEmbedBuilder[]> {
  const { dbConfigs, client, interaction } = options;

  const embeds: InfoEmbedBuilder[] = [];

  for (const dbServerConfig of dbConfigs) {
    try {
      const guild = await client.guilds.fetch(dbServerConfig.server_id);
      const configGuildDbUsers = await UserModelController.getUsersByServer(guild.id);
      const logChannel = dbServerConfig.log_channel
        ? await getTextChannelByID(client, dbServerConfig.log_channel)
        : null;
      const users = await getUserMap(
        configGuildDbUsers.map((user) => user.id),
        client,
      );

      const usersWithoutNull = Array.from(users.values()).filter((user) => user !== null) as User[];

      const embed = buildServerConfigEmbed({
        guild,
        interaction,
        users: usersWithoutNull,
        logChannel,
        dbServerConfig,
      });

      embeds.push(embed);
    } catch (e) {
      await LOGGER.error(
        `An error occurred while fetching information to build a server config embed for ${dbServerConfig.server_id}: ${e}`,
      );
      await interaction.followUp(
        `Failed to fetch information to build a server config embed for server ID ${dbServerConfig.server_id}.`,
      );
    }
  }

  return embeds;
}

function buildServerConfigEmbed(options: {
  interaction: ExtendedInteraction;
  guild: Guild;
  users: User[];
  dbServerConfig: DbServerConfig;
  logChannel: TextChannel | null;
}): InfoEmbedBuilder {
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
        value: `${time(new Date(dbServerConfig.created_at), 'D')}\n(${time(new Date(dbServerConfig.created_at), 'R')})`,
        inline: true,
      },
      {
        name: 'Updated At',
        value: `${time(new Date(dbServerConfig.updated_at), 'D')}\n(${time(new Date(dbServerConfig.updated_at), 'R')})`,
        inline: true,
      },
    ],
  });

  if (guild.iconURL()) {
    embed.setThumbnail(guild.iconURL());
  }

  return embed;
}
