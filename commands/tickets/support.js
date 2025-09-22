// src/commands/tickets/support.js
// → Shows ephemeral panel → triggers interactionCreate.js → creates ticket with embed/buttons

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');
const ticketCategories = require('../../config/ticketCategories.js');

module.exports = {
   new SlashCommandBuilder()
    .setName('support')
    .setDescription('🎫 Open a support ticket with category selection.'),

  async execute(interaction, client, db) {
    try {
      const embed = new EmbedBuilder()
        .setTitle('🎫 Select Ticket Category')
        .setDescription('Choose a category below. Anyone can create any ticket — response access varies.')
        .setColor('#5865F2')
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`ticket_category_select_${interaction.user.id}`) // User-specific to avoid conflicts
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

      // ✅ INSTANT — no defer, no loading
      await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in /support:', error);
      if (!interaction.replied) {
        await interaction.reply({
          content: '❌ Could not open panel. Try again later.',
          ephemeral: true
        });
      }
    }
  }
};
