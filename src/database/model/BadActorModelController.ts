import { Snowflake } from 'discord.js';
import { pgClient } from '../..';

export type DbBadActor = {
  id: number;
  user_id: Snowflake;
  is_active: boolean;
  actor_type: 'spam' | 'impersonation' | 'bigotry';
  screenshot_proof: string | null;
  explanation: string | null;
  created_at: Date;
  updated_at: Date;
  originally_created_in: Snowflake;
  last_changed_by: Snowflake;
};

export abstract class BadActorModelController {
  public static async createBadActor(options: {
    user_id: Snowflake;
    actor_type: 'spam' | 'impersonation' | 'bigotry';
    screenshot_proof?: string | null;
    explanation?: string | null;
    originally_created_in: Snowflake;
    last_changed_by: Snowflake;
  }): Promise<DbBadActor> {
    const badActor = await pgClient.query<DbBadActor>(
      'INSERT INTO bad_actors (user_id, actor_type, screenshot_proof, explanation, originally_created_in, last_changed_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [
        options.user_id,
        options.actor_type,
        options.screenshot_proof,
        options.explanation,
        options.originally_created_in,
        options.last_changed_by,
      ],
    );

    if (!badActor.rows[0]) {
      throw new Error('Failed to create bad actor');
    }

    return badActor.rows[0];
  }

  public static async hasBadActorActiveCase(id: Snowflake): Promise<DbBadActor | null> {
    const badActor = await pgClient.query<DbBadActor>(
      'SELECT * FROM bad_actors WHERE user_id = $1 AND is_active = true LIMIT 1',
      [id],
    );

    if (badActor.rows.length === 0) {
      return null;
    }

    if (!badActor.rows[0]) {
      throw new Error('Failed to check for active bad actor case');
    }

    return badActor.rows[0];
  }

  public static async getBadActorById(id: number): Promise<DbBadActor> {
    const badActor = await pgClient.query<DbBadActor>(
      'SELECT * FROM bad_actors WHERE id = $1 LIMIT 1',
      [id],
    );

    if (!badActor.rows[0]) {
      throw new Error('Failed to get bad actor');
    }

    return badActor.rows[0];
  }

  public static async getBadActorsBySnowflake(id: Snowflake): Promise<DbBadActor[]> {
    const badActors = await pgClient.query<DbBadActor>(
      'SELECT * FROM bad_actors WHERE user_id = $1 LIMIT 10',
      [id],
    );

    return badActors.rows;
  }

  public static async deactivateBadActor(options: {
    id: number;
    explanation: string;
    last_changed_by: Snowflake;
  }): Promise<DbBadActor> {
    const badActor = await pgClient.query<DbBadActor>(
      'UPDATE bad_actors SET is_active = false, explanation = $2, last_changed_by = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [options.id, options.explanation, options.last_changed_by],
    );

    if (!badActor.rows[0]) {
      throw new Error('Failed to deactivate bad actor');
    }

    return badActor.rows[0];
  }

  public static async reactivateBadActor(options: {
    id: number;
    explanation: string;
    last_changed_by: Snowflake;
  }): Promise<DbBadActor> {
    const badActor = await pgClient.query<DbBadActor>(
      'UPDATE bad_actors SET is_active = true, explanation = $2, last_changed_by = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [options.id, options.explanation, options.last_changed_by],
    );

    if (!badActor.rows[0]) {
      throw new Error('Failed to reactivate bad actor');
    }

    return badActor.rows[0];
  }

  public static async deleteBadActor(id: number): Promise<DbBadActor> {
    const badActors = await pgClient.query<DbBadActor>(
      'DELETE FROM bad_actors WHERE id = $1 RETURNING *',
      [id],
    );

    if (!badActors.rows[0]) {
      throw new Error('Failed to delete bad actor');
    }

    return badActors.rows[0];
  }

  public static async getBadActors(
    limit: number,
    type?: 'all' | 'active' | 'inactive',
  ): Promise<DbBadActor[]> {
    if (type === 'active' || type === 'inactive') {
      return pgClient
        .query<DbBadActor>(
          `SELECT * FROM bad_actors WHERE is_active = ${type === 'active' ? 'true' : 'false'} ORDER BY created_at DESC LIMIT $1`,
          [limit],
        )
        .then((r) => r.rows);
    }

    return pgClient
      .query<DbBadActor>('SELECT * FROM bad_actors ORDER BY created_at DESC LIMIT $1', [limit])
      .then((r) => r.rows);
  }

  public static async updateScreenshotProof(
    id: number,
    screenshot: string,
    updatingUserID: Snowflake,
  ): Promise<DbBadActor> {
    const badActor = await pgClient.query<DbBadActor>(
      'UPDATE bad_actors SET screenshot_proof = $2, last_changed_by = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id, screenshot, updatingUserID],
    );

    if (!badActor.rows[0]) {
      throw new Error('Failed to update screenshot proof');
    }

    return badActor.rows[0];
  }

  public static async updateExplanation(
    id: number,
    explanation: string,
    updatingUserID: Snowflake,
  ): Promise<DbBadActor> {
    const badActor = await pgClient.query<DbBadActor>(
      'UPDATE bad_actors SET explanation = $2, last_changed_by = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id, explanation, updatingUserID],
    );

    if (!badActor.rows[0]) {
      throw new Error('Failed to update explanation');
    }

    return badActor.rows[0];
  }
}
