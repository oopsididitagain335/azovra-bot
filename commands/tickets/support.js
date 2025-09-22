// src/commands/tickets/support.js

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');
const ticketCategories = require('../../config/ticketCategories.js');

module.exports = {
  data: new SlashCommandBuilder() // ✅ "data:" was MISSING — this is the fix
    .setName('support')
    .setDescription('🎫 Open a support ticket with category selection.'),

  async execute(interaction, client, db) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle('🎫 Select Ticket Category')
        .setDescription('Choose the category that best fits your request.\n✅ **Everyone can create ANY ticket** — response permissions vary by type.')
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
    } catch (error) {
      console.error('Error in /support:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while opening the panel.',
          ephemeral: true
        });
      }
    }
  }
};
