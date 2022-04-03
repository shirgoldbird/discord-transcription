import { DiscordGatewayAdapterCreator, entersState, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';
import { Client, CommandInteraction, GuildMember, Snowflake, TextChannel, ThreadChannel, User, WebhookClient } from 'discord.js';
import { createListeningStream } from './createListeningStream';

const defaultChannel = "general";

function getDisplayName(interaction: CommandInteraction, client: Client, userId: string) {
    if (interaction.guild.members.cache.get(userId) instanceof GuildMember) { 
        return interaction.guild.members.cache.get(userId).displayName
    }
    const user: User = client.users.cache.get(userId);
	return (user ? `${user.username}_${user.discriminator}` : userId);
}

async function join(
	interaction: CommandInteraction,
	recordable: Record<string, string>,
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
			if (userId in recordable) {
                const displayName: string = getDisplayName(interaction, client, userId);

                if (recording.has(userId)) { 
                    //console.log(`✋ Already recording ${displayName}!`); 
                    return 
                }

                recording.add(userId);

                // Build a thread name that's just today's date (no time)
                const dateString = new Date()
                    .toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
                    .split(",")[0]

                const threadName = `Transcription ${dateString}`;

                // Put our thread in our default channel, if it exists
                const channel: TextChannel = client.channels.cache.find(channel => (channel && channel.type === "GUILD_TEXT" && channel.name === defaultChannel) ) as TextChannel;
                
                if (!channel) { 
                    await interaction.reply({ ephemeral: true, content: `Could not find channel to transcribe to!` }); 
                    return;
                }

                let thread: ThreadChannel = channel.threads.cache.find(x => x.name === threadName);

                if (!thread) {
                    thread = await channel.threads.create({
                        name: threadName,
                        autoArchiveDuration: 60,
                        reason: `Transcript from ${threadName}`,
                    });
                }
                
                const webhooks = await channel.fetchWebhooks();
		        const webhook = webhooks.find(wh => wh.id === recordable[userId]);
                if (webhook) {
                    createListeningStream(webhook, recording, thread, receiver, userId, displayName);
                } else {
                    console.error(`Could not find webhook for user!`)
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
	recordable: Record<string, string>,
	_recording: Set<Snowflake>,
	client: Client,
	connection?: VoiceConnection,
) {
	if (connection) {
		const userId = interaction.options.get('speaker')!.value! as Snowflake;
        const displayName = getDisplayName(interaction, client, userId);

        const channel: TextChannel = client.channels.cache.find(channel => (channel && channel.type === "GUILD_TEXT" && channel.name === defaultChannel) ) as TextChannel;

        // create a new webhook for this user if we don't already have one
        // we'll use the webhook to send messages "as the user" down the line
        if (!(userId in recordable)) {
            const webhooks = await channel.fetchWebhooks();
            const webhook = webhooks.find(wh => wh.name === displayName);

            if (webhook) {
                console.log(`Found existing webhook ${webhook.id} for ${displayName}`);
                recordable[userId] = webhook.id;
            } else {
                channel.createWebhook(getDisplayName(interaction, client, userId), {
                    avatar: interaction.guild.members.cache.get(userId).displayAvatarURL(),
                    reason: userId
                })
                .then(webhook => {
                    console.log(`Created webhook ${webhook.id} for user ${displayName}`);
                    recordable[userId] = webhook.id;
                })
                .catch(console.error);
            }
        }

        await interaction.reply({ ephemeral: true, content: `Transcribing ${getDisplayName(interaction, client, userId)} to thread ${new Date().toISOString().split("T")[0]}` }); //${client.users.cache.get(userId).username}` });
	} else {
		await interaction.reply({ ephemeral: true, content: 'Join a voice channel and then try that again!' });
	}
}

async function leave(
	interaction: CommandInteraction,
	_recordable: Record<string, string>,
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
		recordable: Record<string, string>,
		recording: Set<Snowflake>,
		client: Client,
		connection?: VoiceConnection,
	) => Promise<void>
>();
interactionHandlers.set('join', join);
interactionHandlers.set('record', record);
interactionHandlers.set('leave', leave);
