# 👂 Deepgram Recorder Bot

This example shows how to stream Discord audio to Deepgram. Based on the @discordjs/voice sample recorder bot.

## Potential Extensions

[ ] Send Deepgram output to a Discord channel 

[x] Gracefully handle multiple speakers (check out [Craig Bot](https://craig.chat/home/))

[ ] Clean up websocket handling

## Usage

```sh-session
$ npm install

# Set a bot and Deepgram token (see auth.example.json)
$ cp auth.example.json auth.json
$ nano auth.json

# Start the bot!
$ npm start
```

## Commands

After the bot joins your server, run /deploy to add the following slash commands.

/join - joins your current voice channel
/record <username> - marks you as someone the bot should record
/leave - leaves the current voice channel and unmarks any members marked with /record
