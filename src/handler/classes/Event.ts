import type { ClientEvents } from 'discord.js';

export class DiscordEvent<K extends keyof ClientEvents> {
	public name: K;
	public execute: (...args: ClientEvents[K]) => Promise<void>;

	constructor(name: K, execute: (...args: ClientEvents[K]) => Promise<void>) {
		this.name = name;
		this.execute = execute;
	}
}
