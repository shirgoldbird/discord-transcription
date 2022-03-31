import { EndBehaviorType, VoiceReceiver } from '@discordjs/voice';
import type { User } from 'discord.js';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream';
import { OggLogicalBitstream, OpusHead } from 'prism-media/dist/opus';
const { Deepgram } = require('@deepgram/sdk');
const fs = require('fs');

const { deepgramApiKey } = require('../auth.json');
const mimetype = 'audio/pcm';
const deepgram = new Deepgram(deepgramApiKey);

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

	const filename = `./recordings/${Date.now()}-${getDisplayName(userId, user)}.ogg`;

	const out = createWriteStream(filename);

	console.log(`👂 Started recording ${filename}`);


	pipeline(opusStream, oggStream, out, (err) => {
		if (err) {
			console.warn(`❌ Error recording file ${filename} - ${err.message}`);
		} else {
			console.log(`✅ Recorded ${filename}`);
            deepgram.transcription.preRecorded(
                { buffer: fs.readFileSync(filename), mimetype },
                { punctuate: true, 
                    language: 'en-US',
                    encoding: 'linear16' },
            )
            .then((transcription_obj: object) => {
                console.dir(transcription_obj, {depth: null});
                let transcription = transcription_obj.toString();
                console.log(transcription)
            })
            .catch((err: Error) => {
                console.log(err);
                return err;
            });
		}
	});
}
