import { Snowflake } from 'discord.js';
import { pgClient } from '../..';

export type DbAdmin = {
  id: Snowflake;
  created_at: Date;
};

export default abstract class AdminModelController {
  public static async createAdmin(id: Snowflake): Promise<DbAdmin> {
    const admin = await pgClient.query<DbAdmin>('INSERT INTO admins (id) VALUES ($1) RETURNING *', [
      id,
    ]);

    return admin.rows[0];
  }

  public static async getAdmin(id: Snowflake): Promise<DbAdmin> {
    const admin = await pgClient.query<DbAdmin>('SELECT * FROM admins WHERE id = $1', [id]);

    return admin.rows[0];
  }

  public static async deleteAdmin(id: Snowflake): Promise<DbAdmin> {
    const admin = await pgClient.query<DbAdmin>('DELETE FROM admins WHERE id = $1 RETURNING *', [
      id,
    ]);

    return admin.rows[0];
  }

  public static async getAllAdmins(): Promise<DbAdmin[]> {
    const admins = await pgClient.query<DbAdmin>('SELECT * FROM admins');

    return admins.rows;
  }
}
