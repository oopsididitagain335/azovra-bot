const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('links')
    .setDescription('🔗 Shows quick links including our social media.'),

  async execute(interaction, client, db) {
    try {
      const xLink = "https://x.com/theazorva";
      const socialsChannelId = "1417169776916168714";

      await interaction.reply({
        content: `🔗 **Quick Links**\n\n` +
                 `🐦 **Follow us on X**: [theazorva](${xLink})\n` +
                 `📌 Socials & More: <#${socialsChannelId}>\n` +
                 `ℹ️ Use \`/faq\` for common questions.`,
        ephemeral: false
      });
    } catch (error) {
      console.error('Error in /links:', error);
      await interaction.reply({ content: '❌ Failed to fetch links.', ephemeral: true });
    }
  }
};
