# 👂 Deepgram Recorder Bot

This example shows how to stream Discord audio to Deepgram. Based on the @discordjs/voice sample recorder bot.

## Potential Extensions

[] Send Deepgram output to a Discord channel 
[] Gracefully handle multiple speakers (check out [Craig Bot](https://craig.chat/home/))
[] Clean up websocket handling

## Usage

```sh-session
$ npm install

# Set a bot and Deepgram token (see auth.example.json)
$ cp auth.example.json auth.json
$ nano auth.json

# Start the bot!
$ npm start
```
