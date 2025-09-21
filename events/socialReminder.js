const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client, db) {
    console.log('✅ Social reminder system initialized.');

    // 🔧 CONFIG — WILL AUTO-SET IN DB IF MISSING
    const DEFAULT_X_LINK = "https://x.com/theazorva"; // ✅ Trimmed whitespace
    const DEFAULT_ANNOUNCE_CHANNEL_ID = "1416834521327996928"; // Where reminders are sent
    const DEFAULT_SOCIALS_CHANNEL_ID = "1417169776916168714";   // Mentioned in message

    // On ready, pre-configure DB if not already set
    try {
      for (const guild of client.guilds.cache.values()) {
        // Set X link if not exists
        const currentXLink = await db.get(`x_link_${guild.id}`);
        if (!currentXLink) {
          await db.set(`x_link_${guild.id}`, DEFAULT_X_LINK);
          console.log(`🔑 Set X link for ${guild.name}: ${DEFAULT_X_LINK}`);
        }

        // Set socials channel if not exists
        const currentSocialsChannel = await db.get(`socials_channel_${guild.id}`);
        if (!currentSocialsChannel) {
          await db.set(`socials_channel_${guild.id}`, DEFAULT_SOCIALS_CHANNEL_ID);
          console.log(`🔑 Set socials channel for ${guild.name}: #${DEFAULT_SOCIALS_CHANNEL_ID}`);
        }

        // Set announcement channel if not exists (optional: if you want per-guild control)
        const currentAnnounceChannel = await db.get(`announce_channel_${guild.id}`);
        if (!currentAnnounceChannel) {
          await db.set(`announce_channel_${guild.id}`, DEFAULT_ANNOUNCE_CHANNEL_ID);
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
          // Get configured values (with fallbacks)
          const xLink = (await db.get(`x_link_${guild.id}`))?.trim() || DEFAULT_X_LINK; // ✅ Trim!
          const socialsChannelId = await db.get(`socials_channel_${guild.id}`) || DEFAULT_SOCIALS_CHANNEL_ID;
          const announceChannelId = await db.get(`announce_channel_${guild.id}`) || DEFAULT_ANNOUNCE_CHANNEL_ID;

          // Get announcement channel (where message is sent)
          const announceChannel = guild.channels.cache.get(announceChannelId);
          if (!announceChannel || !announceChannel.isTextBased()) {
            console.log(`⚠️ Announcement channel (${announceChannelId}) not found or inaccessible in ${guild.name}.`);
            continue;
          }

          // Build embed
          const embed = new EmbedBuilder()
            .setColor('#1DA1F2') // Twitter/X blue
            .setTitle('✨ Support Our Community!')
            .setDescription(
              `Check out <#${socialsChannelId}> and make sure to follow our X to stay updated and support us!\n\n` +
              `👉 [**Follow @theazorva on X**](${xLink})`
            )
            .setThumbnail('https://abs.twimg.com/icons/apple-touch-icon-192x192.png')
            .setFooter({ text: 'Your support means everything to us ❤️' })
            .setTimestamp();

          // Send message
          await announceChannel.send({ embeds: [embed] });
          console.log(`✅ Sent social reminder in ${guild.name} → #${announceChannelId}`);

        }
      } catch (error) {
        console.error('❌ Error sending social reminder:', error);
      }
    }, 2 * 60 * 60 * 1000); // Every 2 hours

    console.log('🕗 Social reminders scheduled (every 2 hours) with pre-configured settings.');
  }
};
