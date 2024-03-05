import { Snowflake } from 'discord.js';
import { pgClient } from '../..';

export type DbServerConfig = {
  server_id: Snowflake;
  log_channel: Snowflake | null;
  ping_users: boolean;
  action_level: number;
  timeout_users_with_role: boolean;
  created_at: Date;
  updated_at: Date;
};

type CreateServerConfig = {
  server_id: Snowflake;
  action_level?: number | null;
  log_channel?: Snowflake | null;
  ping_users?: boolean | null;
  timeout_users_with_role?: boolean | null;
};

export abstract class ServerConfigModelController {
  public static async createServerConfig(
    createServerConfig: CreateServerConfig,
  ): Promise<DbServerConfig> {
    const serverConfig = await pgClient.query<DbServerConfig>(
      'INSERT INTO server_configs (server_id, log_channel, ping_users, action_level, timeout_users_with_role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [
        createServerConfig.server_id,
        createServerConfig.log_channel || null,
        createServerConfig.ping_users || false,
        createServerConfig.action_level || 0,
        createServerConfig.timeout_users_with_role || false,
      ],
    );

    return serverConfig.rows[0];
  }

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

  public static async getServerConfig(server_id: Snowflake): Promise<DbServerConfig> {
    const serverConfig = await pgClient.query<DbServerConfig>(
      'SELECT * FROM server_configs WHERE server_id = $1',
      [server_id],
    );

    return serverConfig.rows[0];
  }

  public static async getAllServerConfigs(): Promise<DbServerConfig[]> {
    const serverConfigs = await pgClient.query<DbServerConfig>('SELECT * FROM server_configs');

    return serverConfigs.rows;
  }

  public static async updateServerConfig(
    updateServerConfig: CreateServerConfig,
  ): Promise<DbServerConfig> {
    const currentServerConfig = await this.getServerConfig(updateServerConfig.server_id);

    const actionLevel = updateServerConfig.action_level || currentServerConfig.action_level;
    const logChannel = updateServerConfig.log_channel || currentServerConfig.log_channel;
    const pingUsers = updateServerConfig.ping_users || currentServerConfig.ping_users;
    const timeoutUsersWithRole =
      updateServerConfig.timeout_users_with_role || currentServerConfig.timeout_users_with_role;

    const serverConfig = await pgClient.query<DbServerConfig>(
      'UPDATE server_configs SET log_channel = $1, ping_users = $2, action_level = $3, timeout_users_with_role = $4, updated_at = CURRENT_TIMESTAMP WHERE server_id = $5 RETURNING *',
      [logChannel, pingUsers, actionLevel, timeoutUsersWithRole, updateServerConfig.server_id],
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
