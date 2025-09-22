// src/commands/tickets/support.js

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');
const ticketCategories = require('../../config/ticketCategories.js'); // ✅ Fixed path: was '../' — should be '../../'

module.exports = {
  data: new SlashCommandBuilder()
    .setName('support')
    .setDescription('🎫 Opens a support ticket with category selection.'),
  async execute(interaction, client, db) {
    const embed = new EmbedBuilder()
      .setTitle('🎫 Select Ticket Category')
      .setDescription('Please choose the category that best describes your issue.')
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
            description: cat.description
          }))
        )
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }
};
