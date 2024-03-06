import {
  APIEmbedField,
  ApplicationCommandOptionType,
  AttachmentBuilder,
  Client,
  CommandInteraction,
  Guild,
  User,
  inlineCode,
  time,
  userMention,
} from 'discord.js';
import { Command } from '../handler/classes/Command';
import { config, projectPaths } from '../config';
import { DbUser, UserModelController } from '../database/model/UserModelController';
import Logger from '../log/logger';
import { DbBadActor, BadActorModelController } from '../database/model/BadActorModelController';
import { InfoEmbedBuilder } from '../util/builders';
import { Screenshot } from '../util/attachments';
import { getButtonCollector, getConfirmCancelRow } from '../util/discord';
import path from 'path';

type Subcommand =
  | 'report'
  | 'deactivate'
  | 'reactivate'
  | 'display_latest'
  | 'display_by_user'
  | 'display_by_id'
  | 'add_screenshot'
  | 'update_explanation';

export default new Command({
  name: 'badactor',
  description: 'Report a bad actor to the TMC admins or remove a report',
  options: [
    {
      name: 'report',
      description: 'Report a user for being naughty',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'The user to report. You can also paste their ID here.',
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: 'type',
          description: 'The type of bad act the user did',
          type: ApplicationCommandOptionType.String,
          choices: [
            { name: 'Spam', value: 'spam' },
            { name: 'Impersonation', value: 'impersonation' },
            { name: 'Bigotry', value: 'bigotry' },
          ],
          required: true,
        },
        {
          name: 'screenshot',
          description: 'A screenshot of the bad act. You can upload a file here.',
          type: ApplicationCommandOptionType.Attachment,
        },
        {
          name: 'explanation',
          description: "If you can't provide a screenshot, please explain what happened here.",
          type: ApplicationCommandOptionType.String,
        },
      ],
    },
    {
      name: 'deactivate',
      description: 'Deactivate a user from the bad actor list',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'id',
          description: 'The ID of bad actor entry to deactivate',
          type: ApplicationCommandOptionType.Integer,
          required: true,
        },
        {
          name: 'reason',
          description: 'The reason for deactivating the report',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: 'reactivate',
      description: 'Reactivate a user on the bad actor list',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'id',
          description: 'The ID of bad actor entry to reactivate',
          type: ApplicationCommandOptionType.Integer,
          required: true,
        },
        {
          name: 'reason',
          description: 'The reason for reactivate the report',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: 'add_screenshot',
      description: "Add a screenshot to an existing report that doesn't have one yet",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'id',
          description: 'The ID of the bad actor entry to add the screenshot to',
          type: ApplicationCommandOptionType.Integer,
          required: true,
        },
        {
          name: 'screenshot',
          description: 'The screenshot to add to the report',
          type: ApplicationCommandOptionType.Attachment,
          required: true,
        },
      ],
    },
    {
      name: 'update_explanation',
      description: 'Add an explanation to an existing report or update the existing one',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'id',
          description: 'The ID of the bad actor entry to update the explanation ofs',
          type: ApplicationCommandOptionType.Integer,
          required: true,
        },
        {
          name: 'explanation',
          description: 'The explanation to add to the report',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: 'display_latest',
      description: 'Display the latest bad actors',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'amount',
          description: 'The amount of bad actors to display. Default 5. Max 10.',
          type: ApplicationCommandOptionType.Integer,
        },
      ],
    },
    {
      name: 'display_by_user',
      description: 'Display all entries from a user',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'user',
          description: 'The user to display the entries from. You can also paste their ID here.',
          type: ApplicationCommandOptionType.User,
        },
      ],
    },
    {
      name: 'display_by_id',
      description: 'Display an entry by its ID',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'id',
          description: 'The ID of the entry to display',
          type: ApplicationCommandOptionType.Integer,
          required: true,
        },
      ],
    },
  ],
  execute: async ({ interaction, args, client }) => {
    await interaction.deferReply();

    const interactionGuild = interaction.guild;

    if (!interactionGuild) {
      await interaction.editReply('This command can only be used in a server.');
      Logger.warn(
        `User ${interaction.user.globalName ?? interaction.user.username} attempted to use /badactor outside of a guild.`,
      );
      return;
    }

    const dbUser = await isUserAllowed(interactionGuild, interaction);
    if (!dbUser) return;

    const subcommand = args.getSubcommand() as Subcommand;

    if (subcommand === 'display_latest') {
      const amount = args.getInteger('amount', false) ?? 5;

      if (amount < 1 || amount > 10) {
        await interaction.editReply('The amount must be between 1 and 10.');
        return;
      }

      try {
        const badActors = await BadActorModelController.getBadActors(amount);

        if (badActors.length === 0) {
          await interaction.editReply('There are no bad actors in the database.');
          Logger.warn(
            `User ${interaction.user.globalName ?? interaction.user.username} attempted to use /badactor display in ${interactionGuild.name} but there are no bad actors in the database.`,
          );
          return;
        }

        const res = await getBadActorEmbeds(badActors, interaction.user, client);
        const embeds = res.map(([embed]) => embed);
        const attachments = res
          .map(([, attachment]) => attachment)
          .filter((a) => a !== null) as AttachmentBuilder[];

        await interaction.editReply({ embeds, files: attachments });
      } catch (e) {
        await interaction.editReply(`Failed to get bad actors from the database.`);
        Logger.error(`Failed to get bad actors from the database: ${e}`);
        return;
      }
    }

    if (subcommand === 'display_by_user') {
      const user = args.getUser('user', true);

      if (!user) {
        await interaction.editReply(
          'Cannot find the user. You either made a typo or the user does not exist (anymore).',
        );
        Logger.warn(
          `${interaction.user.globalName ?? interaction.user.username} attempted to use /badactor display in ${interactionGuild.name} but did not provide a valid user.`,
        );
        return;
      }

      try {
        const badActors = await BadActorModelController.getBadActorsBySnowflake(user.id);

        if (badActors.length === 0) {
          await interaction.editReply('This user is not reported as a bad actor.');
          return;
        }

        const res = await getBadActorEmbeds(badActors, interaction.user, client);
        const embeds = res.map(([embed]) => embed);
        const attachments = res
          .map(([, attachment]) => attachment)
          .filter((a) => a !== null) as AttachmentBuilder[];

        await interaction.editReply({ embeds, files: attachments });
      } catch (e) {
        await interaction.editReply(`Failed to get bad actors from the database.`);
        Logger.error(`Failed to get bad actors from the database: ${e}`);
        return;
      }
    }

    if (subcommand === 'display_by_id') {
      const id = args.getInteger('id', true);

      try {
        const badActor = await BadActorModelController.getBadActorById(id);

        if (!badActor) {
          await interaction.editReply('This entry does not exist.');
          return;
        }

        const res = await getBadActorEmbeds([badActor], interaction.user, client);
        const embeds = res.map(([embed]) => embed);
        const attachments = res
          .map(([, attachment]) => attachment)
          .filter((a) => a !== null) as AttachmentBuilder[];

        await interaction.editReply({ embeds, files: attachments });
      } catch (e) {
        await interaction.editReply(`Failed to get the bad actor from the database.`);
        Logger.error(`Failed to get the bad actor from the database: ${e}`);
        return;
      }
    }

    if (subcommand === 'report') {
      const badActorUser = args.getUser('user', true);
      const type = args.getString('type', true) as 'spam' | 'impersonation' | 'bigot';
      const attachment = args.getAttachment('screenshot', false);
      const explanation = args.getString('explanation', false);

      if (!badActorUser) {
        await interaction.editReply(
          'Cannot find the user. You either made a typo or the user does not exist (anymore).',
        );
        Logger.warn(
          `${interaction.user.globalName ?? interaction.user.username} attempted to use /badactor report in ${interactionGuild.name} but did not provide a valid user.`,
        );
        return;
      }

      try {
        const activeCase = await BadActorModelController.hasBadActorActiveCase(badActorUser.id);

        if (activeCase) {
          const res = await getBadActorEmbeds([activeCase], interaction.user, client);
          const embeds = res.map(([embed]) => embed);
          const attachments = res
            .map(([, attachment]) => attachment)
            .filter((a) => a !== null) as AttachmentBuilder[];

          await interaction.editReply({
            content: 'This user is already reported as a bad actor.',
            embeds,
            files: attachments,
          });

          return;
        }
      } catch (e) {
        await interaction.editReply(
          `Failed to check if the user is already reported as a bad actor.`,
        );
        Logger.error(`Failed to check if the user is already reported as a bad actor: ${e}`);
        return;
      }

      if (!attachment && !explanation) {
        await interaction.editReply('You must provide a screenshot or an explanation.');
        Logger.warn(
          `${interaction.user.globalName ?? interaction.user.username} attempted to use /badactor report in ${interactionGuild.name} but did not provide a screenshot or an explanation.`,
        );
        return;
      }

      const badActorUserEmbed = await buildBadActorUserEmbed(interaction.user, badActorUser);

      await interaction.editReply({
        content: 'Is this the user you want to report?',
        embeds: [badActorUserEmbed],
        components: [getConfirmCancelRow()],
      });

      const collector = getButtonCollector(interaction);

      if (!collector) {
        await interaction.editReply('Failed to create a button collector.');
        Logger.error(`Failed to create a button collector for /badactor report.`);
        return;
      }

      collector.on('collect', async (buttonInteraction) => {
        if (buttonInteraction.customId === 'confirm') {
          await interaction.editReply({
            content: 'Reporting user to the community and taking action...',
            components: [],
            embeds: [],
          });

          let screenshotPath: string | null = null;

          if (attachment) {
            try {
              const screenshot = new Screenshot(attachment, interaction.user.id);
              screenshotPath = screenshot.path;
              await screenshot.saveToFileSystem();
            } catch (e) {
              await interaction.editReply(`Failed to save the screenshot.`);
              Logger.error(`Failed to save the screenshot: ${e}`);
              return;
            }
          }

          try {
            const dbBadActor = await BadActorModelController.createBadActor({
              actor_type: type,
              user_id: badActorUser.id,
              last_changed_by: interaction.user.id,
              originally_created_in: interactionGuild.id,
              screenshot_proof: screenshotPath,
              explanation: explanation ?? null,
            });

            Logger.info(
              `User ${interaction.user.globalName ?? interaction.user.username} reported user ${badActorUser.globalName ?? badActorUser.username} as a bad actor in ${interactionGuild.name}.`,
            );

            try {
              const res = await getBadActorEmbeds([dbBadActor], interaction.user, client);
              const embeds = res.map(([embed]) => embed);
              const attachments = res
                .map(([, attachment]) => attachment)
                .filter((a) => a !== null) as AttachmentBuilder[];

              await interaction.editReply({ embeds, files: attachments });
            } catch (e) {
              await interaction.editReply('Failed to send the bad actor embed.');
              Logger.error(`Failed to send the bad actor embed: ${e}`);
              return;
            }
          } catch (e) {
            await interaction.editReply(`Failed to create a bad actor in the database.`);
            Logger.error(`Failed to create a bad actor in the database: ${e}`);
            return;
          }
        } else if (buttonInteraction.customId === 'cancel') {
          await interaction.editReply({
            content: 'Cancelled the report.',
            components: [],
            embeds: [],
          });
        }
      });
    }

    if (subcommand === 'deactivate') {
      const id = args.getInteger('id', true);
      const reason = args.getString('reason', true);

      try {
        const badActor = await BadActorModelController.getBadActorById(id);

        if (!badActor) {
          await interaction.editReply('This entry does not exist.');
          return;
        }

        if (!badActor.is_active) {
          await interaction.editReply('This entry is already deactivated.');
          return;
        }

        await BadActorModelController.deactivateBadActor({
          id,
          explanation: reason,
          last_changed_by: interaction.user.id,
        });

        Logger.info(
          `User ${interaction.user.globalName ?? interaction.user.username} deactivated bad actor ${id} in ${interactionGuild.name}.`,
        );

        try {
          const res = await getBadActorEmbeds([badActor], interaction.user, client);
          const embeds = res.map(([embed]) => embed);
          const attachments = res
            .map(([, attachment]) => attachment)
            .filter((a) => a !== null) as AttachmentBuilder[];

          await interaction.editReply({ embeds, files: attachments });
        } catch (e) {
          await interaction.editReply(
            'Failed to send the bad actor embed. The entry has been deactivated.',
          );
          Logger.error(`Failed to send the bad actor embed: ${e}`);
        }
      } catch (e) {
        await interaction.editReply(`Failed to get the bad actor from the database.`);
        Logger.error(`Failed to get the bad actor from the database: ${e}`);
        return;
      }
    }

    if (subcommand === 'reactivate') {
      const id = args.getInteger('id', true);
      const reason = args.getString('reason', true);

      try {
        const badActor = await BadActorModelController.getBadActorById(id);

        if (!badActor) {
          await interaction.editReply('This entry does not exist.');
          return;
        }

        if (badActor.is_active) {
          await interaction.editReply('This entry is already activated.');
          return;
        }

        await BadActorModelController.reactivateBadActor({
          id,
          explanation: reason,
          last_changed_by: interaction.user.id,
        });

        Logger.info(
          `User ${interaction.user.globalName ?? interaction.user.username} reactivated bad actor ${id} in ${interactionGuild.name}.`,
        );

        try {
          const res = await getBadActorEmbeds([badActor], interaction.user, client);
          const embeds = res.map(([embed]) => embed);
          const attachments = res
            .map(([, attachment]) => attachment)
            .filter((a) => a !== null) as AttachmentBuilder[];

          await interaction.editReply({ embeds, files: attachments });
        } catch (e) {
          await interaction.editReply(
            'Failed to send the bad actor embed. The entry has been reactivated.',
          );
          Logger.error(`Failed to send the bad actor embed: ${e}`);
        }
      } catch (e) {
        await interaction.editReply(`Failed to get the bad actor from the database.`);
        Logger.error(`Failed to get the bad actor from the database: ${e}`);
        return;
      }
    }

    if (subcommand === 'add_screenshot') {
      const id = args.getInteger('id', true);
      const attachment = args.getAttachment('screenshot', true);

      try {
        const badActor = await BadActorModelController.getBadActorById(id);

        if (!badActor) {
          await interaction.editReply('This entry does not exist.');
          return;
        }

        if (!badActor.is_active) {
          await interaction.editReply(
            'This entry is deactivated. You cannot add a screenshot to it.',
          );
          return;
        }

        if (badActor.screenshot_proof) {
          await interaction.editReply('This entry already has a screenshot.');
          return;
        }

        const screenshot = new Screenshot(attachment, interaction.user.id);
        await screenshot.saveToFileSystem();

        await BadActorModelController.updateScreenshotProof(
          id,
          screenshot.path,
          interaction.user.id,
        );

        Logger.info(
          `User ${interaction.user.globalName ?? interaction.user.username} added a screenshot to bad actor ${id} in ${interactionGuild.name}.`,
        );

        try {
          const res = await getBadActorEmbeds([badActor], interaction.user, client);
          const embeds = res.map(([embed]) => embed);
          const attachments = res
            .map(([, attachment]) => attachment)
            .filter((a) => a !== null) as AttachmentBuilder[];

          await interaction.editReply({ embeds, files: attachments });
        } catch (e) {
          await interaction.editReply('Failed to send the bad actor embed.');
          Logger.error(`Failed to send the bad actor embed: ${e}`);
        }
      } catch (e) {
        await interaction.editReply(`Failed to get the bad actor from the database.`);
        Logger.error(`Failed to get the bad actor from the database: ${e}`);
        return;
      }
    }

    if (subcommand === 'update_explanation') {
      const id = args.getInteger('id', true);
      const explanation = args.getString('explanation', true);

      try {
        const badActor = await BadActorModelController.getBadActorById(id);

        if (!badActor) {
          await interaction.editReply('This entry does not exist.');
          return;
        }

        if (!badActor.is_active) {
          await interaction.editReply(
            'This entry is deactivated. You cannot add an explanation to it.',
          );
          return;
        }

        await BadActorModelController.updateExplanation(id, explanation, interaction.user.id);

        Logger.info(
          `User ${interaction.user.globalName ?? interaction.user.username} added an explanation to bad actor ${id} in ${interactionGuild.name}.`,
        );

        try {
          const res = await getBadActorEmbeds([badActor], interaction.user, client);
          const embeds = res.map(([embed]) => embed);
          const attachments = res
            .map(([, attachment]) => attachment)
            .filter((a) => a !== null) as AttachmentBuilder[];

          await interaction.editReply({ embeds, files: attachments });
        } catch (e) {
          await interaction.editReply('Failed to send the bad actor embed.');
          Logger.error(`Failed to send the bad actor embed: ${e}`);
        }
      } catch (e) {
        await interaction.editReply(`Failed to get the bad actor from the database.`);
        Logger.error(`Failed to get the bad actor from the database: ${e}`);
        return;
      }
    }
  },
});

async function isUserAllowed(
  guild: Guild,
  interaction: CommandInteraction,
): Promise<DbUser | null> {
  try {
    const dbUser = await UserModelController.getUser(interaction.user.id);

    if (!dbUser) {
      await interaction.editReply('You are not allowed to use this command.');
      Logger.warn(
        `User ${interaction.user.globalName ?? interaction.user.username} attempted to use /badactor in ${guild.name} but the user does not exist in the database.`,
      );
      return null;
    }

    if (!dbUser.servers.includes(guild.id) || guild.id === config.adminServerID) {
      await interaction.editReply('You are not allowed to use this command here.');
      Logger.warn(
        `${interaction.user.globalName ?? interaction.user.username} attempted to use /badactor in ${guild.name} but the user is not allowed to use it there.`,
      );
      return null;
    }

    return dbUser;
  } catch (e) {
    await interaction.editReply(`Failed to get user: ${e}`);
    Logger.error(`Failed to get user from the database: ${e}`);
    return null;
  }
}

async function getBadActorEmbeds(
  badActors: DbBadActor[],
  interactionUser: User,
  client: Client,
): Promise<Array<[InfoEmbedBuilder, AttachmentBuilder | null]>> {
  const embeds: Array<[InfoEmbedBuilder, AttachmentBuilder | null]> = [];

  for (const badActor of badActors) {
    const badActorUser = await client.users.fetch(badActor.user_id).catch(() => {
      Logger.warn(`Failed to fetch user ${badActor.user_id} user for embed creation.`);
      return null;
    });

    const initialGuild = await client.guilds.fetch(badActor.originally_created_in).catch(() => {
      Logger.warn(`Failed to fetch guild ${badActor.originally_created_in} for embed creation.`);
      return null;
    });

    const embedTitle =
      badActorUser === null
        ? `Bad Actor ${badActor.id}`
        : `Bad Actor ${badActorUser.globalName ?? badActorUser.username}`;

    const embedDescription =
      badActorUser === null
        ? 'Discord user cannot be found. They might have been deleted by Discord.'
        : '';

    const embedFields: APIEmbedField[] = [
      { name: 'Database Entry ID', value: inlineCode(badActor.id.toString()) },
      { name: 'User ID', value: inlineCode(badActor.user_id) },
      { name: 'Active', value: badActor.is_active ? 'Yes' : 'No' },
      { name: 'Type', value: badActor.actor_type },
      {
        name: 'Explanation/Reason',
        value: badActor.explanation ?? 'No explanation provided.',
      },
      {
        name: 'Server of Origin',
        value: initialGuild
          ? `${initialGuild.name} (${inlineCode(initialGuild.id)})`
          : inlineCode(badActor.originally_created_in),
      },
      {
        name: 'Created At',
        value: `${time(new Date(badActor.created_at), 'D')}\n(${time(
          new Date(badActor.created_at),
          'R',
        )})`,
      },
      {
        name: 'Last Updated At',
        value: `${time(new Date(badActor.updated_at), 'D')}\n(${time(
          new Date(badActor.updated_at),
          'R',
        )})`,
      },
      {
        name: 'Last Updated By',
        value: `${userMention(badActor.last_changed_by)} (${inlineCode(badActor.last_changed_by)})`,
      },
    ];

    const embed = new InfoEmbedBuilder(interactionUser, {
      title: embedTitle,
      description: embedDescription,
      fields: embedFields,
    });

    if (badActorUser) {
      embed.setThumbnail(badActorUser.displayAvatarURL());
    }

    let attachment: AttachmentBuilder | null = null;

    if (badActor.screenshot_proof) {
      try {
        attachment = new AttachmentBuilder(
          path.join(projectPaths.sources, '..', 'screenshots', badActor.screenshot_proof),
        );
      } catch (e) {
        Logger.error(`Failed to create attachment for bad actor ${badActor.id}: ${e}`);
      }
    }

    if (attachment) {
      embed.setImage(`attachment://${badActor.screenshot_proof}`);
    }

    embeds.push([embed, attachment]);
  }

  return embeds;
}

async function buildBadActorUserEmbed(interactionUser: User, targetUser: User) {
  return new InfoEmbedBuilder(interactionUser, {
    title: `Info User ${targetUser.globalName ?? targetUser.username}`,
    thumbnail: {
      url: targetUser.displayAvatarURL(),
    },
    fields: [
      { name: 'ID', value: inlineCode(targetUser.id) },
      {
        name: 'Created At',
        value: `${time(new Date(targetUser.createdAt), 'D')}\n(${time(new Date(targetUser.createdAt), 'R')})`,
      },
    ],
  });
}
