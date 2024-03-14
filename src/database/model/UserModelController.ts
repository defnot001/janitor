import { Snowflake } from 'discord.js';
import { pgClient } from '../..';

export type DbUser = {
  id: Snowflake;
  user_type: 'reporter' | 'listener';
  servers: Snowflake[];
  created_at: Date;
};

export abstract class UserModelController {
  public static async createUser(createUser: {
    id: Snowflake;
    user_type: 'reporter' | 'listener';
    servers: Snowflake[];
  }): Promise<DbUser> {
    const user = await pgClient.query<DbUser>(
      'INSERT INTO users (id, user_type, servers) VALUES ($1, $2, $3) RETURNING *',
      [createUser.id, createUser.user_type, createUser.servers],
    );

    if (!user.rows[0]) {
      throw new Error('Failed to create user.');
    }

    return user.rows[0];
  }

  public static async getUser(id: Snowflake): Promise<DbUser | undefined> {
    const user = await pgClient.query<DbUser>('SELECT * FROM users WHERE id = $1', [id]);

    return user.rows[0];
  }

  public static async updateUser(updateUser: {
    id: Snowflake;
    user_type: 'reporter' | 'listener';
    servers: Snowflake[];
  }): Promise<DbUser> {
    const user = await pgClient.query<DbUser>(
      'UPDATE users SET user_type = $1, servers = $2 WHERE id = $3 RETURNING *',
      [updateUser.user_type, updateUser.servers, updateUser.id],
    );

    if (!user.rows[0]) {
      throw new Error('Failed to update user.');
    }

    return user.rows[0];
  }

  public static async deleteUser(id: Snowflake): Promise<DbUser> {
    const user = await pgClient.query<DbUser>('DELETE FROM users WHERE id = $1 RETURNING *', [id]);

    if (!user.rows[0]) {
      throw new Error('Failed to delete user.');
    }

    return user.rows[0];
  }

  public static async getAllUsers(limit?: Number): Promise<DbUser[]> {
    if (!limit) {
      const users = await pgClient.query<DbUser>('SELECT * FROM users');

      return users.rows;
    } else {
      const users = await pgClient.query<DbUser>('SELECT * FROM users LIMIT $1', [limit]);

      return users.rows;
    }
  }

  public static async getUsersByServer(server: Snowflake): Promise<DbUser[]> {
    const users = await pgClient.query<DbUser>('SELECT * FROM users WHERE $1 = ANY(servers)', [
      server,
    ]);

    return users.rows;
  }

  public static async getUniqueServerIDs(): Promise<Snowflake[]> {
    const result = await pgClient.query('SELECT DISTINCT unnest(servers) AS server_id FROM users');
    return result.rows.map((row) => row.server_id);
  }

  public static async getUserListByServer(guildID: Snowflake): Promise<DbUser[]> {
    const users = await pgClient.query<DbUser>('SELECT * FROM users WHERE $1 = ANY(servers)', [
      guildID,
    ]);

    return users.rows;
  }
}
