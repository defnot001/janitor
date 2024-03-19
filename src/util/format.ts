import {
	Guild,
	GuildMember,
	TextChannel,
	User,
	escapeMarkdown,
	inlineCode,
	time,
} from 'discord.js';

type Displayable = Guild | User | GuildMember | TextChannel;

export function display(obj: Displayable): string {
	if (obj instanceof Guild) {
		return `${obj.name} (${obj.id})`;
	}

	if (obj instanceof User) {
		return `${obj.globalName ?? obj.username} (${obj.id})`;
	}

	if (obj instanceof GuildMember) {
		return `${obj.user.globalName ?? obj.user.username} (${obj.id})`;
	}

	if (obj instanceof TextChannel) {
		return `#${obj.name} (${obj.id})`;
	}

	return 'Unknown object type.';
}

export function displayFormatted(obj: Displayable): string {
	if (obj instanceof Guild) {
		return `${escapeMarkdown(obj.name)} (${inlineCode(obj.id)})`;
	}

	if (obj instanceof User) {
		return `${escapeMarkdown(obj.globalName ?? obj.username)} (${inlineCode(obj.id)})`;
	}

	if (obj instanceof GuildMember) {
		return `${escapeMarkdown(obj.user.globalName ?? obj.user.username)} (${inlineCode(obj.id)})`;
	}

	if (obj instanceof TextChannel) {
		return `${escapeMarkdown(obj.name)} (${inlineCode(obj.id)})`;
	}

	return 'Unknown object type.';
}

export function displayDateTimeFormatted(dateTime: Date): string {
	return `${time(dateTime, 'D')}\n(${time(dateTime, 'R')})`;
}
