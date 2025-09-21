const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const ticketCategories = require('../config/ticketCategories.js');

module.exports = {
  data: new SlashCommandBuilder() // Assign to 'data' property
    .setName('sec')
    .setDescription('🔐 Sends the ticket panel to the designated channel.'),
  async execute(interaction, client, db) {
    // Only allow specific user
    if (interaction.user.id !== '1400281740978815118') {
      return interaction.reply({
        content: '⛔ You do not have permission to use this command.',
        ephemeral: true
      });
    }
    await interaction.deferReply({ ephemeral: true });
    const targetChannelId = '1416833955528708147';
    const targetChannel = await client.channels.fetch(targetChannelId).catch(() => null);
    if (!targetChannel) {
      return interaction.editReply({ content: '❌ Target channel not found. Check ID.', ephemeral: true });
    }
    const embed = new EmbedBuilder()
      .setTitle('🎫 Open a Support Ticket')
      .setDescription('Select the category that best fits your issue.\nA private ticket channel will be created for you.')
      .setColor('#5865F2')
      .setFooter({ text: 'Support Team' })
      .setTimestamp();
    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ticket_category_select')
          .setPlaceholder('Select a category...')
          .addOptions(
            ticketCategories.categories.map(cat => ({
              label: cat.label,
              value: cat.value,
              description: cat.description
            }))
          )
      );
    await targetChannel.send({ embeds: [embed], components: [row] });
    await interaction.editReply({ content: `✅ Ticket panel sent to <#${targetChannelId}>`, ephemeral: true });
  }
};
