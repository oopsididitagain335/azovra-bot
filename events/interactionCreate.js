// src/events/interactionCreate.js

const {
  Events,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');
const ticketCategories = require('../config/ticketCategories.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client, db) {
    // Handle StringSelectMenu (ticket category selection)
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_category_select')) {
      await handleTicketCreation(interaction, client, db);
    }
  }
};

async function handleTicketCreation(interaction, client, db) {
  const [prefix, userId] = interaction.customId.split('_');

  // Validate if it's user-specific or global panel
  if (userId && userId !== interaction.user.id) {
    return interaction.reply({
      content: '❌ This panel is not for you.',
      ephemeral: true
    });
  }

  const categoryId = interaction.values[0];
  const category = ticketCategories.categories.find(c => c.value === categoryId);

  if (!category) {
    return interaction.reply({
      content: '❌ Invalid category selected.',
      ephemeral: true
    });
  }

  await interaction.deferUpdate(); // Acknowledge selection without visible reply

  const guild = interaction.guild;
  const member = await guild.members.fetch(interaction.user.id);

  // Get Support Role (replace ID with your actual Support role ID)
  const SUPPORT_ROLE_ID = 'YOUR_SUPPORT_ROLE_ID_HERE'; // ⚠️ REPLACE THIS
  const supportRole = guild.roles.cache.get(SUPPORT_ROLE_ID);

  if (!supportRole && category.supportOnly) {
    console.warn('Support role not found. Skipping permission grant.');
  }

  // Create ticket channel under appropriate parent (optional: use category ID)
  const parentCategoryId = 'YOUR_TICKET_CATEGORY_ID_HERE'; // Optional — replace or remove
  const parent = parentCategoryId ? guild.channels.cache.get(parentCategoryId) : null;

  try {
    const ticketChannel = await guild.channels.create({
      name: `${category.value}-${interaction.user.username}`.substring(0, 99),
      type: 0, // Text channel
      parent: parent || null,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        },
        {
          id: client.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        }
      ],
      topic: `Ticket for ${interaction.user.tag} | Category: ${category.label}`
    });

    // Add Support Role if applicable (not for adminOnly tickets)
    if (supportRole && category.supportOnly && !category.adminOnly) {
      await ticketChannel.permissionOverwrites.create(supportRole, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });
    }

    // Add Admins for adminOnly tickets
    if (category.adminOnly) {
      const admins = await guild.members.fetch({ force: true });
      const adminMembers = admins.filter(m => m.permissions.has(PermissionFlagsBits.Administrator));

      for (const [id, adminMember] of adminMembers) {
        await ticketChannel.permissionOverwrites.create(adminMember, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });
      }
    }

    // Send welcome message in ticket
    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`🎫 ${category.label} Ticket`)
      .setDescription(`Hello ${interaction.user},\nA team member will be with you shortly.\n\n**Category:** ${category.label}\n**User:** ${interaction.user.tag}`)
      .setColor('#5865F2')
      .setTimestamp()
      .setFooter({ text: 'Thank you for your patience!' });

    await ticketChannel.send({
      content: supportRole && !category.adminOnly ? `${supportRole}` : `@here`,
      embeds: [welcomeEmbed]
    });

    // Reply to user with ticket info
    await interaction.followUp({
      content: `✅ Your ticket has been created: ${ticketChannel} — please check there.`,
      ephemeral: true
    });

    // Log ticket creation (optional)
    console.log(`🎟️ Ticket created: #${ticketChannel.name} by ${interaction.user.tag} for ${category.label}`);

  } catch (error) {
    console.error('❌ Failed to create ticket:', error);
    await interaction.followUp({
      content: '❌ Failed to create your ticket. Please contact staff.',
      ephemeral: true
    });
  }
}
