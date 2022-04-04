# 👂 Deepgram Recorder Bot

This example shows how to stream Discord audio to Deepgram. 

## Interface

The bot lets you define a channel to transcribe voice calls to. It then uses webhooks to transcribe messages as the users who are talking.

<img width="503" alt="image" src="https://user-images.githubusercontent.com/3937986/161467356-c8d1aaef-b11d-495a-a275-ea407e784452.png">

## Usage

```sh-session
$ npm install

# Set a bot token, Deepgram token, and transcription channel (see auth.example.json)
$ cp auth.example.json auth.json
$ nano auth.json

# Start the bot!
$ npm start
```

## Bot Setup

### Bot Scopes

- bot
- application.commands

### Bot Permissions

- Manage Webhooks
- Send Messages
- Use Slash Commands
- Connect
- Use Voice Activity

## Commands

After the bot joins your server, type `!deploy` to add the following slash commands.

/join - joins your current voice channel
/record <username> - marks you as someone the bot should record
/leave - leaves the current voice channel and unmarks any members marked with /record
