import Discord, { Interaction, TextChannel } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import { deploy } from './deploy';
import { interactionHandlers } from './interactions';

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const { token, defaultChannel } = require('../auth.json');

const client = new Discord.Client({ intents: ['GUILD_VOICE_STATES', 'GUILD_MESSAGES', 'GUILDS'] });

client.on('ready', () => console.log('Ready!'));

client.on('messageCreate', async (message) => {
	if (!message.guild) return;
	if (!client.application?.owner) await client.application?.fetch();

	if (message.content.toLowerCase() === '!deploy' && message.author.id === client.application?.owner?.id) {
		await deploy(message.guild);

        const webhooks = await message.guild.fetchWebhooks();
        const webhook = webhooks.find(wh => wh.name === "Deepgram");

        const channel = message.guild.channels.cache.find(channel => (channel && channel.type === "GUILD_TEXT" && channel.name === defaultChannel) ) as TextChannel;

        if (webhook) {
            console.log(`Found existing Deepgram webhook ${webhook.id}`);
        } else {
            channel.createWebhook("Deepgram")
            .then(webhook => {
                console.log(`Created Deepgram webhook ${webhook.id}`);
            })
            .catch(console.error);
        }

		await message.reply('Deployed!');
	}
});

/**
 * The IDs of the users that can be recorded by the bot.
 */
const recordable = new Set<string>();
const recording = new Set<string>();

client.on('interactionCreate', async (interaction: Interaction) => {
	if (!interaction.isCommand() || !interaction.guildId) return;

	const handler = interactionHandlers.get(interaction.commandName);

	try {
		if (handler) {
			await handler(interaction, recordable, recording, client, getVoiceConnection(interaction.guildId));
		} else {
			await interaction.reply('Unknown command');
		}
	} catch (error) {
		console.warn(error);
	}
});

client.on('error', console.warn);

void client.login(token);
