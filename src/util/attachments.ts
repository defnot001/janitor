import * as fs from 'node:fs/promises';
import path from 'node:path';
import type { Attachment, Snowflake } from 'discord.js';
import { LOGGER } from './logger';

const STORAGE_DIRECTORY_PATH = 'screenshots' as const;

export class Screenshot {
	private readonly renamed_file_name: string;

	public constructor(
		public readonly newAttachment: Attachment,
		public readonly badActorID: Snowflake,
	) {
		if (
			!newAttachment.name.endsWith('.png') &&
			!newAttachment.name.endsWith('.jpg') &&
			!newAttachment.name.endsWith('.jpeg')
		) {
			throw new Error('Invalid file type. Only PNG, JPEG, and JPG files are allowed.');
		}

		if (newAttachment.size > 5e6) {
			throw new Error(
				`File size too large. Max file size is 5MB, but got ${newAttachment.size} bytes.`,
			);
		}

		const fileExtension = newAttachment.name.split('.').pop();
		const currentDate = new Date().toISOString().split('T')[0];
		this.renamed_file_name = `${currentDate}_${badActorID}.${fileExtension}`;
	}

	public get path() {
		return this.renamed_file_name;
	}

	private async downloadFileBuffer(): Promise<Buffer> {
		const res = await fetch(this.newAttachment.url);

		if (!res.ok) {
			throw new Error(`Failed to fetch the file: ${res.statusText}`);
		}

		const arrayBuffer = await res.arrayBuffer();
		return Buffer.from(arrayBuffer);
	}

	public async saveToFileSystem(): Promise<void> {
		try {
			const filePath = path.join(STORAGE_DIRECTORY_PATH, this.renamed_file_name);

			try {
				await fs.access(filePath);
				throw new Error(`File already exists: ${filePath}`);
			} catch (e) {
				if (e && typeof e === 'object' && 'code' in e && e.code !== 'ENOENT') {
					throw new Error(`Failed to access file: ${e}`);
				}

				if (
					e &&
					typeof e === 'object' &&
					'message' in e &&
					typeof e.message === 'string' &&
					e.message.startsWith('File already exists')
				) {
					throw e;
				}

				const buffer = await this.downloadFileBuffer();
				await fs.writeFile(filePath, buffer);
				LOGGER.info(`File saved to ${filePath}`);
			}
		} catch (e) {
			throw new Error(`Failed to save file: ${e}`);
		}
	}

	public static async deleteFromFileSystem(oldImagePath: string): Promise<void> {
		const filePath = path.join(STORAGE_DIRECTORY_PATH, oldImagePath);

		try {
			await fs.unlink(filePath);
			LOGGER.info(`File deleted: ${oldImagePath}`);
		} catch (e) {
			await LOGGER.error(`Failed to delete file at ${oldImagePath}: ${e}`);
		}
	}

	public async replaceFileInFileSystem(oldImagePath: string): Promise<void> {
		const oldFilePath = path.join(STORAGE_DIRECTORY_PATH, oldImagePath);

		try {
			await fs.unlink(oldFilePath);
			LOGGER.info(`Old file deleted: ${oldImagePath}`);
		} catch (e) {
			await LOGGER.error(`Failed to delete old file at ${oldImagePath}: ${e}`);
		}

		await this.saveToFileSystem();
	}
}
