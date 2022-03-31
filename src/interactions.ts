import { DiscordGatewayAdapterCreator, entersState, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';
import { Client, CommandInteraction, GuildMember, Snowflake, TextChannel, ThreadChannel } from 'discord.js';
import { createListeningStream } from './createListeningStream';

async function join(
	interaction: CommandInteraction,
	recordable: Set<Snowflake>,
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
                const dateString = new Date().toISOString().split("T")[0]

                const threadName = `Transcription ${dateString}`;//client.users.cache.get(userId).username;

                const channel: TextChannel = client.channels.cache.find(channel => (channel && channel.type === "GUILD_TEXT" && channel.name === "general") ) as TextChannel;

                if (!channel) { await interaction.reply({ ephemeral: true, content: `Could not find channel to transcribe to!` }); }

                let thread: ThreadChannel = channel.threads.cache.find(x => x.name === threadName);

                if (!thread) {
                    thread = await channel.threads.create({
                        name: threadName,
                        autoArchiveDuration: 60,
                        reason: `Transcript from ${threadName}`,
                    });
                }

                createListeningStream(thread, receiver, userId, client.users.cache.get(userId));
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
	client: Client,
	connection?: VoiceConnection,
) {
	if (connection) {
		const userId = interaction.options.get('speaker')!.value! as Snowflake;
		recordable.add(userId);

		const receiver = connection.receiver;
		if (connection.receiver.speaking.users.has(userId)) {
            console.log("recording from record function!") // NOTE: this seems to never actually run
			createListeningStream(null, receiver, userId, client.users.cache.get(userId));
		}

        await interaction.reply({ ephemeral: true, content: `Transcribing to thread ${client.users.cache.get(userId).username}` });
	} else {
		await interaction.reply({ ephemeral: true, content: 'Join a voice channel and then try that again!' });
	}
}

async function leave(
	interaction: CommandInteraction,
	recordable: Set<Snowflake>,
	_client: Client,
	connection?: VoiceConnection,
) {
	if (connection) {
		connection.destroy();
		recordable.clear();
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
		client: Client,
		connection?: VoiceConnection,
	) => Promise<void>
>();
interactionHandlers.set('join', join);
interactionHandlers.set('record', record);
interactionHandlers.set('leave', leave);
