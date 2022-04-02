import { DiscordGatewayAdapterCreator, entersState, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';
import { Client, CommandInteraction, GuildMember, Snowflake, TextChannel, ThreadChannel, User } from 'discord.js';
import { createListeningStream } from './createListeningStream';


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

                // Build a thread name that's just today's date (no time)
                const dateString = new Date().toISOString().split("T")[0]
                const threadName = `Transcription ${dateString}`;

                // Put our thread in #general, if it exists
                const channel: TextChannel = client.channels.cache.find(channel => (channel && channel.type === "GUILD_TEXT" && channel.name === "general") ) as TextChannel;
                
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

                createListeningStream(recording, thread, receiver, userId, displayName);
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

        await interaction.reply({ ephemeral: true, content: `Transcribing ${getDisplayName(interaction, client, userId)} to thread ${new Date().toISOString().split("T")[0]}` }); //${client.users.cache.get(userId).username}` });
	} else {
		await interaction.reply({ ephemeral: true, content: 'Join a voice channel and then try that again!' });
	}
}

async function leave(
	interaction: CommandInteraction,
	recordable: Set<Snowflake>,
	recording: Set<Snowflake>,
	_client: Client,
	connection?: VoiceConnection,
) {
	if (connection) {
		connection.destroy();
		recordable.clear();
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
