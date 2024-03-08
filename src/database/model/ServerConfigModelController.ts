import { Snowflake } from 'discord.js';
import { pgClient } from '../..';

export enum ActionLevel {
  Notify = 0,
  Timeout = 1,
  Kick = 2,
  SoftBan = 3,
  Ban = 4,
}

export function displayActionLevel(actionLevel: ActionLevel): string {
  switch (actionLevel) {
    case ActionLevel.Notify:
      return 'Notify';
    case ActionLevel.Timeout:
      return 'Timeout';
    case ActionLevel.Kick:
      return 'Kick';
    case ActionLevel.SoftBan:
      return 'Soft Ban';
    case ActionLevel.Ban:
      return 'Ban';
  }
}

export type DbServerConfig = {
  server_id: Snowflake;
  log_channel: Snowflake | null;
  ping_users: boolean;
  spam_action_level: ActionLevel;
  impersonation_action_level: ActionLevel;
  bigotry_action_level: ActionLevel;
  timeout_users_with_role: boolean;
  ignored_roles: Snowflake[];
  created_at: Date;
  updated_at: Date;
};
type CreateServerConfig = {
  server_id: Snowflake;
  spam_action_level?: ActionLevel | null;
  impersonation_action_level?: ActionLevel | null;
  bigotry_action_level?: ActionLevel | null;
  log_channel?: Snowflake | null;
  ping_users?: boolean | null;
  timeout_users_with_role?: boolean | null;
  ignored_roles?: Snowflake[] | null;
};

export abstract class ServerConfigModelController {
  public static async createServerConfigIfNotExists(
    server_id: Snowflake,
  ): Promise<DbServerConfig | null> {
    const result = await pgClient.query<DbServerConfig>(
      'INSERT INTO server_configs (server_id) VALUES ($1) ON CONFLICT (server_id) DO NOTHING RETURNING *',
      [server_id],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  public static async getServerConfig(server_id: Snowflake): Promise<DbServerConfig | null> {
    const serverConfig = await pgClient.query<DbServerConfig>(
      'SELECT * FROM server_configs WHERE server_id = $1',
      [server_id],
    );

    return serverConfig.rows[0];
  }

  public static async getServerConfigs(server_ids: Snowflake[]): Promise<DbServerConfig[]> {
    const query = 'SELECT * FROM server_configs WHERE server_id = ANY($1::text[])';
    const values = [server_ids];
    const result = await pgClient.query<DbServerConfig>(query, values);
    return result.rows;
  }

  public static async getAllServerConfigs(): Promise<DbServerConfig[]> {
    const serverConfigs = await pgClient.query<DbServerConfig>('SELECT * FROM server_configs');

    return serverConfigs.rows;
  }

  public static async updateServerConfig(
    updateServerConfig: CreateServerConfig,
  ): Promise<DbServerConfig> {
    const currentServerConfig = await this.getServerConfig(updateServerConfig.server_id);

    if (!currentServerConfig) {
      throw new Error('Server config does not exist');
    }

    const spam_action_level =
      updateServerConfig.spam_action_level || currentServerConfig.spam_action_level;
    const impersonation_action_level =
      updateServerConfig.impersonation_action_level ||
      currentServerConfig.impersonation_action_level;
    const bigotry_action_level =
      updateServerConfig.bigotry_action_level || currentServerConfig.bigotry_action_level;

    const logChannel = updateServerConfig.log_channel || currentServerConfig.log_channel;
    const pingUsers = updateServerConfig.ping_users || currentServerConfig.ping_users;
    const timeoutUsersWithRole =
      updateServerConfig.timeout_users_with_role || currentServerConfig.timeout_users_with_role;
    const ignoredRoles = updateServerConfig.ignored_roles || currentServerConfig.ignored_roles;

    const serverConfig = await pgClient.query<DbServerConfig>(
      'UPDATE server_configs SET spam_action_level = $1, impersonation_action_level = $2, bigotry_action_level = $3, log_channel = $4, ping_users = $5, timeout_users_with_role = $6, ignored_roles = $7, updated_at = NOW() WHERE server_id = $8 RETURNING *',
      [
        spam_action_level,
        impersonation_action_level,
        bigotry_action_level,
        logChannel,
        pingUsers,
        timeoutUsersWithRole,
        ignoredRoles,
        updateServerConfig.server_id,
      ],
    );

    return serverConfig.rows[0];
  }

  public static async deleteServerConfig(server_id: Snowflake): Promise<DbServerConfig> {
    const serverConfig = await pgClient.query<DbServerConfig>(
      'DELETE FROM server_configs WHERE server_id = $1 RETURNING *',
      [server_id],
    );

    return serverConfig.rows[0];
  }

  public static async deleteServerConfigIfNeeded(serverID: Snowflake): Promise<boolean> {
    const userCheckResult = await pgClient.query<{ id: Snowflake }>(
      'SELECT id FROM users WHERE $1 = ANY(servers)',
      [serverID],
    );

    if (userCheckResult.rows.length === 0) {
      await this.deleteServerConfig(serverID);
      return true;
    }

    return false;
  }
}
