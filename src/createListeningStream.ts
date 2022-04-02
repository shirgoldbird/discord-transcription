import { EndBehaviorType, VoiceReceiver } from '@discordjs/voice';
import type { Snowflake, ThreadChannel, User } from 'discord.js';
import { pipeline } from 'node:stream';
import { OggLogicalBitstream, OpusHead } from 'prism-media/dist/opus';
const WebSocket = require('ws');
const WebSocketStream = require('websocket-stream')
const { Transform } = require('stream')
const { deepgram_token } = require('../auth.json');

export function createListeningStream(recording: Set<Snowflake>, thread: ThreadChannel, receiver: VoiceReceiver, userId: string, displayName: string) {
    const opusStream = receiver.subscribe(userId, {
        end: {
            behavior: EndBehaviorType.AfterInactivity,
            duration: 500,
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

	console.log(`👂 Started recording ${displayName}`);

    const socket = new WebSocket('wss://api.deepgram.com/v1/listen?punctuate=true', {
        headers: {
            Authorization: `Token ${deepgram_token}`,
        },
    })

    const deepgramParse = new Transform({
        decodeStrings: false,
        transform(chunk: string, _encoding: any, done: (arg0: any, arg1: string) => void) {
            const data = JSON.parse(chunk).channel.alternatives[0].transcript + ' ';

            done(null, data);
        }
    });

    const discordSend = new Transform({
        transform(chunk: string, _encoding: any, done: (arg0: any, arg1: string) => void) {
            try {
                chunk = chunk.toString();
                const trimmedData = chunk.trim().replace(/(\r\n|\n|\r|)/gm, "");
                if (trimmedData.length > 0) {
                    console.log(`${displayName}: ${chunk}`);
                    thread.send(`${displayName}: ${chunk}`);
                }
            } catch (err) {
                console.error(err);
                done(err, null);
            }

            done(null, chunk);
        }
    })

    const ws = WebSocketStream(socket);
    
    ws.pipe(deepgramParse).pipe(discordSend);

	pipeline(opusStream, oggStream, ws, (err) => {
		if (err) {
			console.warn(`❌ Error recording user ${displayName} - ${err.message}`);
		} else {
			console.log(`✅ Recorded user ${displayName}`);
		}
        recording.delete(userId);
	});
}
