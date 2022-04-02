import { EndBehaviorType, VoiceReceiver } from '@discordjs/voice';
import type { Snowflake, ThreadChannel, User } from 'discord.js';
import { pipeline } from 'node:stream';
import { OggLogicalBitstream, OpusHead } from 'prism-media/dist/opus';
const WebSocket = require('ws');
const WebSocketStream = require('websocket-stream')
const { Transform } = require('stream')
import { readFileSync, createWriteStream } from 'node:fs';
const { deepgram_token } = require('../auth.json');

function getDisplayName(userId: string, user?: User) {
	return user ? `${user.username}_${user.discriminator}` : userId;
}

export function createListeningStream(recording: Set<Snowflake>, thread: ThreadChannel, receiver: VoiceReceiver, userId: string, user?: User) {
    const opusStream = receiver.subscribe(userId, {
        end: {
            behavior: EndBehaviorType.AfterSilence,
            duration: 1000,
        },
    });

	const oggStream = new OggLogicalBitstream({
		opusHead: new OpusHead({
			channelCount: 2,
			sampleRate: 48000,
		}),
		pageSizeControl: {
			maxPackets: 10,
		},
	});

	console.log(`👂 Started recording ${getDisplayName(userId, user)}`);

    const socket = new WebSocket('wss://api.deepgram.com/v1/listen?punctuate=true', {
        headers: {
            Authorization: `Token ${deepgram_token}`,
        },
    })

    let deepgramParse = new Transform({
        decodeStrings: false
    });

    deepgramParse._transform = function(chunk, _encoding, done) {
        done(null, JSON.parse(chunk).channel.alternatives[0].transcript + ' ');
    };

    let fullFilename = `./recordings/${user.username}_${new Date().toISOString().split(".")[0]}.txt`;

	const out = createWriteStream(fullFilename);

    const ws = WebSocketStream(socket);

	pipeline(opusStream, oggStream, ws, (err) => {
		if (err) {
			console.warn(`❌ Error recording user ${getDisplayName(userId, user)} - ${err.message}`);
		} else {
			console.log(`✅ Recorded user ${getDisplayName(userId, user)}`);
            recording.delete(userId);
            let stream = ws.pipe(deepgramParse).pipe(out);
            stream.on('finish', function () { 
                try {
                    const data = readFileSync(fullFilename).toString()
                    const trimmedData = data.trim().replace(/(\r\n|\n|\r|)/gm, "");
                    if (trimmedData.length > 0) {
                        console.log(`${user.username}: ${data}`);
                        thread.send(`${user.username}: ${data}`);
                    }
                } catch (err) {
                    console.error(err)
                }
            });
		}
	});
}
