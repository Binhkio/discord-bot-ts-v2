const { SlashCommandBuilder, CommandInteraction } = require('discord.js');
const { addEmbed, multiAddEmbed } = require('../../components/embed');
const {
    createNewVoiceConnectionFromInteraction,
} = require('../../utils/channel');
const playdl = require('play-dl');
const ytdl = require('@distube/ytdl-core');
const { textToSpeech } = require('../../utils/tts');
const { getDownloadUrl } = require('../../utils/stream');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play Youtube music!')
        .addStringOption((option) =>
            option
                .setName('url')
                .setDescription('URL of Youtube video or playlist')
                .setRequired(true)
        )
        .addBooleanOption((option) =>
            option
                .setName('playlist')
                .setDescription(
                    "Type true if it is a playlist's url else type false"
                )
        ),
    /**
     * @param {CommandInteraction} interaction
     */
    async execute(interaction) {
        const player = global.client.player;
        player.channel = interaction.channel;

        if (!player.voiceConnection) {
            const newVoiceConnection =
                await createNewVoiceConnectionFromInteraction(interaction);
            player.subscription = newVoiceConnection.subscribe(player);
            player.voiceConnection = newVoiceConnection;

            const currHour = new Date(
                new Date().getTime() + 7 * 60 * 60 * 1000
            ).getHours();
            const greet =
                currHour < 12 ? 'sáng' : currHour < 19 ? 'chiều' : 'tối';
            const fullGreeting = `Chào buổi ${greet} cả nhà`;
            textToSpeech(fullGreeting);
        }

        const url = interaction.options.getString('url');
        const isPlaylist = interaction.options.getBoolean('playlist') || false;

        const type = playdl.yt_validate(url);
        if (!type || !url.startsWith('https')) {
            // Can use search
            await interaction.editReply(`Invalid URL. Please try again!`);
            return;
        } else if (
            type === 'video' ||
            (type === 'playlist' && !isPlaylist && url.includes('watch'))
        ) {
            const valid_url = url.split('&')[0];

            // const info = await playdl.video_info(valid_url);
            // const track = info.video_details;
            const info = await ytdl.getBasicInfo(valid_url);
            const track = info.videoDetails;
            track.user = interaction.user;

            // Get download url
            getDownloadUrl(track.url || track.video_url).then((dlUrl) => {
                player.downloadUrls[track.id || track.videoId] = dlUrl;
                console.log(
                    `ADD_TRACK: ${track.id || track.videoId} - ${
                        player.downloadUrls[track.id || track.videoId]
                    }`
                );
            });

            // Add track to queue
            player.queue.push(track);

            const embed = addEmbed(player.queue, track);
            await interaction.editReply({
                embeds: [embed],
            });
        } else if (
            (type === 'playlist' && isPlaylist) ||
            url.includes('playlist')
        ) {
            const info = await playdl.playlist_info(url);
            const tracks = await info.all_videos();

            tracks.forEach((track) => {
                track.user = interaction.user;

                // Get download url
                getDownloadUrl(track.url || track.video_url).then((dlUrl) => {
                    player.downloadUrls[track.id || track.videoId] = dlUrl;
                    console.log(
                        `ADD_TRACK: ${track.id || track.videoId} - ${
                            player.downloadUrls[track.id || track.videoId]
                        }`
                    );
                });

                // Add tracks to queue
                player.queue.push(track);
            });

            const embed = multiAddEmbed(player.queue, info, tracks);
            await interaction.editReply({
                embeds: [embed],
            });
        }

        // Play new audio if player is not playing
        if (!player.isPlaying) {
            player.emit('skip');
        } else {
        }
    },
};
