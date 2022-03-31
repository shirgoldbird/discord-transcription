import { EndBehaviorType, VoiceReceiver } from '@discordjs/voice';
import type { User } from 'discord.js';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream';
import { OggLogicalBitstream, OpusHead } from 'prism-media/dist/opus';
const WebSocket = require('ws');
const WebSocketStream = require('websocket-stream')
const { Writable, Transform } = require('stream')

const { deepgram_token } = require('../auth.json');

function getDisplayName(userId: string, user?: User) {
	return user ? `${user.username}_${user.discriminator}` : userId;
}

export function createListeningStream(receiver: VoiceReceiver, userId: string, user?: User) {
	const opusStream = receiver.subscribe(userId, {
		end: {
			behavior: EndBehaviorType.AfterSilence,
			duration: 100,
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

    const socket = new WebSocket('wss://api.deepgram.com/v1/listen', {
        headers: {
            Authorization: `Token ${deepgram_token}`,
        },
    })

    var deepgramParse = new Transform({
        decodeStrings: false
    });

    deepgramParse._transform = function(chunk, encoding, done) {
        done(null, JSON.parse(chunk).channel.alternatives[0].transcript + '\n');
    };

    const ws = WebSocketStream(socket);

	pipeline(opusStream, oggStream, ws, (err) => {
		if (err) {
			console.warn(`❌ Error recording user ${getDisplayName(userId, user)} - ${err.message}`);
		} else {
			console.log(`✅ Recorded user ${getDisplayName(userId, user)}`);
            ws.pipe(deepgramParse).pipe(process.stdout);
		}
	});
}
