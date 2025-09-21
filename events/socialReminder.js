const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client, db) {
    console.log('✅ Social reminder system initialized.');

    // YOUR PROVIDED CONFIG — WILL AUTO-SET IN DB
    const DEFAULT_X_LINK = "https://x.com/theazorva";
    const ANNOUNCEMENT_CHANNEL_ID = "1416834521327996928"; // Where reminder is sent every 2 hrs
    const SOCIALS_CHANNEL_ID = "1417169776916168714";      // Mentioned in message

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
          await db.set(`socials_channel_${guild.id}`, SOCIALS_CHANNEL_ID);
          console.log(`🔑 Set socials channel for ${guild.name}: #${SOCIALS_CHANNEL_ID}`);
        }
      }
    } catch (error) {
      console.error('❌ Error pre-configuring DB:', error);
    }

    // Start 2-hour interval
    setInterval(async () => {
      try {
        for (const guild of client.guilds.cache.values()) {
          // Get configured values
          const xLink = await db.get(`x_link_${guild.id}`) || DEFAULT_X_LINK;
          const socialsChannelId = await db.get(`socials_channel_${guild.id}`) || SOCIALS_CHANNEL_ID;

          // Get announcement channel (where message is sent)
          const announceChannel = guild.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);
          if (!announceChannel || !announceChannel.isTextBased()) {
            console.log(`⚠️  Announcement channel not found or inaccessible in ${guild.name}.`);
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
          console.log(`✅ Sent social reminder in ${guild.name} (Channel: ${ANNOUNCEMENT_CHANNEL_ID})`);

        }
      } catch (error) {
        console.error('❌ Error sending social reminder:', error);
      }
    }, 2 * 60 * 60 * 1000); // Every 2 hours

    console.log('🕗 Social reminders scheduled (every 2 hours) with pre-configured settings.');
  }
};
