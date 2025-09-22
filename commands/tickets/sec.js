// src/commands/tickets/sec.js

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');
const ticketCategories = require('../../config/ticketCategories.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sec')
    .setDescription('🔐 Send or update the persistent ticket panel.'),

  async execute(interaction, client, db) {
    if (interaction.user.id !== '1400281740978815118') {
      return interaction.reply({
        content: '⛔ You do not have permission to use this command.',
        ephemeral: true
      });
    }

    await interaction.reply({
      content: '⏳ Updating ticket panel...',
      ephemeral: true
    });

    const targetChannelId = '1416833955528708147';
    const targetChannel = await client.channels.fetch(targetChannelId).catch(() => null);

    if (!targetChannel) {
      return interaction.editReply({
        content: '❌ Target channel not found. Check ID.',
        ephemeral: true
      });
    }

    let panelMessage = null;
    try {
      const messages = await targetChannel.messages.fetch({ limit: 50 });
      panelMessage = messages.find(msg =>
        msg.author.id === client.user.id &&
        msg.embeds?.[0]?.title?.includes('Open a Support Ticket')
      );
    } catch (error) {
      console.error('Error searching for panel:', error);
    }

    const embed = new EmbedBuilder()
      .setTitle('🎫 Open a Support Ticket')
      .setDescription('✅ Anyone can create any ticket — just select below!\nResponse access depends on ticket type.')
      .setColor('#5865F2')
      .setFooter({ text: 'Support Team' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ticket_category_select')
        .setPlaceholder('Select a category...')
        .addOptions(
          ticketCategories.categories.map(cat => ({
            label: cat.label,
            value: cat.value,
            description: cat.description,
            emoji: { name: cat.emoji }
          }))
        )
    );

    try {
      if (panelMessage) {
        await panelMessage.edit({ embeds: [embed], components: [row] });
        await interaction.editReply({
          content: `✅ Updated ticket panel in <#${targetChannelId}>`,
          ephemeral: true
        });
      } else {
        await targetChannel.send({ embeds: [embed], components: [row] });
        await interaction.editReply({
          content: `✅ Sent new ticket panel to <#${targetChannelId}>`,
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('Failed to send/update panel:', error);
      await interaction.editReply({
        content: '❌ Failed to send or update panel. Check bot permissions.',
        ephemeral: true
      });
    }
  }
};
