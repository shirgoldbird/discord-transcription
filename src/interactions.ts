import { DiscordGatewayAdapterCreator, entersState, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';
import { Client, CommandInteraction, GuildMember, Snowflake, TextChannel, ThreadChannel, User, WebhookClient } from 'discord.js';
import { createListeningStream } from './createListeningStream';
const { defaultChannel } = require('../auth.json');

function getDisplayName(interaction: CommandInteraction, client: Client, userId: string) {
    if (interaction.guild.members.cache.get(userId) instanceof GuildMember) { 
        return interaction.guild.members.cache.get(userId).displayName
    }
    const user: User = client.users.cache.get(userId);
	return (user ? `${user.username}_${user.discriminator}` : userId);
}

async function join(
	interaction: CommandInteraction,
	recordable: Set<Snowflake>,
	recording: Set<Snowflake>,
	client: Client,
	connection?: VoiceConnection,
) {
	await interaction.deferReply();
	if (!connection) {
		if (interaction.member instanceof GuildMember && interaction.member.voice.channel) {
			const channel = interaction.member.voice.channel;
			connection = joinVoiceChannel({
				channelId: channel.id,
				guildId: channel.guild.id,
				selfDeaf: false,
				selfMute: true,
				adapterCreator: channel.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
			});
		} else {
			await interaction.followUp('Join a voice channel and then try that again!');
			return;
		}
	}

	try {
		await entersState(connection, VoiceConnectionStatus.Ready, 20e3);
		const receiver = connection.receiver;

		receiver.speaking.on('start', async (userId) => {
			if (recordable.has(userId)) {
                const displayName: string = getDisplayName(interaction, client, userId);

                if (recording.has(userId)) { 
                    //console.log(`✋ Already recording ${displayName}!`); 
                    return 
                }

                recording.add(userId);

                // Find our default channel, if it exists
                const channel: TextChannel = client.channels.cache.find(channel => (channel && channel.type === "GUILD_TEXT" && channel.name === defaultChannel) ) as TextChannel;
                
                if (!channel) { 
                    await interaction.reply({ ephemeral: true, content: `Could not find channel to transcribe to!` }); 
                    return;
                }

                const webhooks = await channel.fetchWebhooks();
		        let webhook = webhooks.find(wh => wh.name === "Deepgram");
                if (webhook) {
                    createListeningStream(webhook, recording, receiver, userId, displayName, interaction.guild.members.cache.get(userId).displayAvatarURL());
                } else {
                    console.error(`Could not find webhook! Creating...`)
                    const channel = client.channels.cache.find(channel => (channel && channel.type === "GUILD_TEXT" && channel.name === defaultChannel) ) as TextChannel;

                    channel.createWebhook("Deepgram")
                        .then(webhook => {
                            console.log(`Created Deepgram webhook ${webhook.id}`);
                            createListeningStream(webhook, recording, receiver, userId, displayName, interaction.guild.members.cache.get(userId).displayAvatarURL());
                        })
                        .catch(console.error);
                }
            }
		});
	} catch (error) {
		console.warn(error);
		await interaction.followUp('Failed to join voice channel within 20 seconds, please try again later!');
	}

	await interaction.followUp('Ready!');
}

async function record(
	interaction: CommandInteraction,
	recordable: Set<Snowflake>,
	_recording: Set<Snowflake>,
	client: Client,
	connection?: VoiceConnection,
) {
	if (connection) {
		const userId = interaction.options.get('speaker')!.value! as Snowflake;

        recordable.add(userId);

        await interaction.reply({ ephemeral: true, content: `Transcribing ${getDisplayName(interaction, client, userId)} to #${defaultChannel}` });
	} else {
		await interaction.reply({ ephemeral: true, content: 'Join a voice channel and then try that again!' });
	}
}

async function leave(
	interaction: CommandInteraction,
	_recordable: Set<Snowflake>,
	recording: Set<Snowflake>,
	_client: Client,
	connection?: VoiceConnection,
) {
	if (connection) {
		connection.destroy();
		// recordable.clear();
        recording.clear();
		await interaction.reply({ ephemeral: true, content: 'Left the channel!' });
	} else {
		await interaction.reply({ ephemeral: true, content: 'Not playing in this server!' });
	}
}

export const interactionHandlers = new Map<
	string,
	(
		interaction: CommandInteraction,
		recordable: Set<Snowflake>,
		recording: Set<Snowflake>,
		client: Client,
		connection?: VoiceConnection,
	) => Promise<void>
>();
interactionHandlers.set('join', join);
interactionHandlers.set('record', record);
interactionHandlers.set('leave', leave);
