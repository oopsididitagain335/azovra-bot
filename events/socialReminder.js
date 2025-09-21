const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client, railwayDB) { // ✅ Accept railwayDB — DO NOT import from index.js!
    console.log('✅ Social reminder system initialized.');

    const DEFAULT_X_LINK = "https://x.com/theazorva";
    const DEFAULT_ANNOUNCE_CHANNEL_ID = "1416834521327996928"; // Where reminder is sent
    const DEFAULT_SOCIALS_CHANNEL_ID = "1417169776916168714";   // Mentioned in message

    // Pre-configure DB for each guild
    try {
      for (const guild of client.guilds.cache.values()) {
        // Set X link
        const currentXLink = await railwayDB.get(`x_link_${guild.id}`);
        if (!currentXLink) {
          await railwayDB.set(`x_link_${guild.id}`, DEFAULT_X_LINK);
          console.log(`🔑 Set X link for ${guild.name}: ${DEFAULT_X_LINK}`);
        }

        // Set socials channel
        const currentSocialsChannel = await railwayDB.get(`socials_channel_${guild.id}`);
        if (!currentSocialsChannel) {
          await railwayDB.set(`socials_channel_${guild.id}`, DEFAULT_SOCIALS_CHANNEL_ID);
          console.log(`🔑 Set socials channel for ${guild.name}: #${DEFAULT_SOCIALS_CHANNEL_ID}`);
        }

        // Set announcement channel
        const currentAnnounceChannel = await railwayDB.get(`announce_channel_${guild.id}`);
        if (!currentAnnounceChannel) {
          await railwayDB.set(`announce_channel_${guild.id}`, DEFAULT_ANNOUNCE_CHANNEL_ID);
          console.log(`🔑 Set announcement channel for ${guild.name}: #${DEFAULT_ANNOUNCE_CHANNEL_ID}`);
        }
      }
    } catch (error) {
      console.error('❌ Error pre-configuring DB:', error);
    }

    // Start 2-hour interval
    setInterval(async () => {
      try {
        for (const guild of client.guilds.cache.values()) {
          const xLink = (await railwayDB.get(`x_link_${guild.id}`))?.trim() || DEFAULT_X_LINK;
          const socialsChannelId = await railwayDB.get(`socials_channel_${guild.id}`) || DEFAULT_SOCIALS_CHANNEL_ID;
          const announceChannelId = await railwayDB.get(`announce_channel_${guild.id}`) || DEFAULT_ANNOUNCE_CHANNEL_ID;

          const announceChannel = guild.channels.cache.get(announceChannelId);
          if (!announceChannel || !announceChannel.isTextBased()) {
            console.log(`⚠️ Announcement channel (${announceChannelId}) not found in ${guild.name}.`);
            continue;
          }

          const embed = new EmbedBuilder()
            .setColor('#1DA1F2')
            .setTitle('✨ Support Our Community!')
            .setDescription(
              `Check out <#${socialsChannelId}> and follow our X to stay updated!\n\n` +
              `👉 [**Follow @theazorva on X**](${xLink})`
            )
            .setThumbnail('https://abs.twimg.com/icons/apple-touch-icon-192x192.png')
            .setFooter({ text: 'Your support means everything to us ❤️' })
            .setTimestamp();

          await announceChannel.send({ embeds: [embed] });
          console.log(`✅ Sent social reminder in ${guild.name} → #${announceChannelId}`);
        }
      } catch (error) {
        console.error('❌ Error sending social reminder:', error);
      }
    }, 2 * 60 * 60 * 1000); // Every 2 hours

    console.log('🕗 Social reminders scheduled (every 2 hours).');
  }
};
