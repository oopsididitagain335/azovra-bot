// src/commands/tickets/support.js

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');
const ticketCategories = require('../../config/ticketCategories.js');

module.exports = {
  data: new SlashCommandBuilder() // ✅ FIXED: added "data:"
    .setName('support')
    .setDescription('🎫 Open a support ticket with category selection.'),

  async execute(interaction, client, db) {
    // Defer to avoid interaction timeout
    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle('🎫 Select Ticket Category')
      .setDescription('Choose the category that best fits your request.\nYou can create ANY ticket — response permissions vary.')
      .setColor('#5865F2')
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`ticket_category_select_${interaction.user.id}`)
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

    await interaction.editReply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }
};
