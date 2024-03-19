import { EmbedBuilder } from '@discordjs/builders';
import { type TextChannel, userMention } from 'discord.js';
import { client } from '..';
import { botConfig } from '../config';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type ErrorWithMessage = {
	message: string;
};

const colors = {
	reset: '\x1b[0m',
	debug: '\x1b[36m', // Cyan for better visibility
	info: '\x1b[34m', // Blue
	warn: '\x1b[33m', // Yellow
	error: '\x1b[31m', // Red
};

let errorLog: TextChannel | null = null;

export abstract class LOGGER {
	public static setLogChannel(channel: TextChannel | null): void {
		errorLog = channel;
	}

	public static debug(message: string): void {
		LOGGER.log(message, 'debug');
	}

	public static info(message: string): void {
		LOGGER.log(message, 'info');
	}

	public static async warn(message: string): Promise<void> {
		LOGGER.log(message, 'warn');
		try {
			const embed = LOGGER.buildLogEmbed(message, 'warn');
			await errorLog?.send({ embeds: [embed] });
		} catch (e) {
			LOGGER.log(`Failed to send error log to errorLog channel: ${e}`, 'error');
		}
	}

	public static async error(error: unknown, message?: string): Promise<void> {
		const cleanError = LOGGER.getCleanError(error);
		const errorMessage = message ? `${message}: ${cleanError.message}` : cleanError.message;

		LOGGER.log(errorMessage, 'error');

		try {
			const embed = LOGGER.buildLogEmbed(errorMessage, 'error');
			// Optionally, add the stack trace or other error details if available and desired
			if (cleanError.stack) {
				embed.addFields({
					name: 'Stack Trace',
					value: `\`\`\`${cleanError.stack}\`\`\``,
				});
			}
			await errorLog?.send({ content: userMention(botConfig.superuser), embeds: [embed] });
		} catch (e) {
			LOGGER.log(`Failed to send error log to errorLog channel: ${e}`, 'error');
		}
	}

	private static buildLogEmbed(message: string, level: 'warn' | 'error') {
		const errorLogEmbed = new EmbedBuilder({
			description: message,
			color: level === 'warn' ? 16_776_960 : 16_711_680,
			author: {
				name: 'Janitor',
				icon_url: client.user?.displayAvatarURL(),
			},
			footer: {
				text: 'Error Log',
			},
		});

		return errorLogEmbed.setTimestamp(Date.now());
	}

	private static log(message: string, logLevel: LogLevel): void {
		const now = new Date();
		const timeString = `[${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(
			2,
			'0',
		)}-${String(now.getUTCDate()).padStart(2, '0')}] [${String(now.getUTCHours()).padStart(
			2,
			'0',
		)}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(
			2,
			'0',
		)}]`;
		const logLevelString = `${LOGGER.displayLogLevel(logLevel)}:`;
		const coloredPrefix = `${colors[logLevel]}${timeString} ${logLevelString}${colors.reset}`;

		console.log(`${coloredPrefix} ${message}`);
	}

	private static displayLogLevel(logLevel: LogLevel): string {
		switch (logLevel) {
			case 'debug':
				return 'DEBUG';
			case 'info':
				return 'INFO';
			case 'warn':
				return 'WARN';
			case 'error':
				return 'ERROR';
			default:
				return 'UNKNOWN'; // Fallback case
		}
	}

	private static getCleanError(maybeError: unknown): Error {
		if (maybeError instanceof Error) {
			return maybeError;
		}

		if (LOGGER.isErrorWithMessage(maybeError)) {
			return new Error(maybeError.message, { cause: maybeError });
		}

		try {
			return new Error(JSON.stringify(maybeError));
		} catch {
			// fallback in case there's an error stringifying the maybeError
			// like with circular references for example.
			return new Error(String(maybeError));
		}
	}

	private static isErrorWithMessage(error: unknown): error is ErrorWithMessage {
		return (
			typeof error === 'object' &&
			error !== null &&
			'message' in error &&
			// biome-ignore lint/complexity/useLiteralKeys: <explanation>
			typeof (error as Record<string, unknown>)['message'] === 'string'
		);
	}
}
