import type { Snowflake } from 'discord.js';
import { pgClient } from '../..';

export type DbAdmin = {
	id: Snowflake;
	created_at: Date;
};

export abstract class AdminModelController {
	public static async getAllAdmins(): Promise<DbAdmin[]> {
		const admins = await pgClient.query<DbAdmin>('SELECT * FROM admins');

		return admins.rows;
	}

	public static async isAdmin(id: Snowflake): Promise<boolean> {
		const admin = await pgClient.query<DbAdmin>('SELECT * FROM admins WHERE id = $1', [id]);

		return admin.rows.length > 0;
	}
}
