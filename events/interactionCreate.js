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
    // Handle ticket category selection from ANY panel
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_category_select')) {
      await handleTicketCreation(interaction, client, db);
    }
  }
};

async function handleTicketCreation(interaction, client, db) {
  // ✅ DO NOT BLOCK BASED ON USER ID — allow anyone to use any panel
  // We only care about the selected value

  const categoryId = interaction.values[0];
  const category = ticketCategories.categories.find(c => c.value === categoryId);

  if (!category) {
    return interaction.reply({
      content: '❌ Invalid category. Please try again.',
      ephemeral: true
    });
  }

  // Acknowledge interaction without visible reply
  await interaction.deferUpdate();

  const guild = interaction.guild;

  // Fetch member (in case not cached)
  const member = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    return interaction.followUp({
      content: '❌ Could not load your member data. Try again later.',
      ephemeral: true
    });
  }

  // Get Support Role — REPLACE WITH YOUR ACTUAL ROLE ID
  const SUPPORT_ROLE_ID = 'YOUR_SUPPORT_ROLE_ID_HERE'; // ⚠️ SET THIS
  const supportRole = guild.roles.cache.get(SUPPORT_ROLE_ID);

  if (category.supportOnly && !supportRole) {
    console.warn('⚠️ Support role not found. Proceeding without granting support access.');
  }

  // Optional: Place tickets under a category
  const PARENT_CATEGORY_ID = 'YOUR_TICKET_CATEGORY_ID_HERE'; // optional
  const parent = PARENT_CATEGORY_ID ? guild.channels.cache.get(PARENT_CATEGORY_ID) : null;

  try {
    // Create private ticket channel
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
          id: interaction.user.id, // Ticket creator
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        },
        {
          id: client.user.id, // Bot
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        }
      ],
      topic: `Ticket for ${interaction.user.tag} | Category: ${category.label}`
    });

    // Grant Support Role access — if applicable and NOT admin-only
    if (supportRole && category.supportOnly && !category.adminOnly) {
      await ticketChannel.permissionOverwrites.create(supportRole, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });
    }

    // Grant ALL ADMINS access — if adminOnly OR as backup
    const admins = await guild.members.fetch();
    const adminMembers = admins.filter(m => m.permissions.has(PermissionFlagsBits.Administrator));

    for (const [id, adminMember] of adminMembers) {
      await ticketChannel.permissionOverwrites.create(adminMember, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });
    }

    // Send welcome message
    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`🎫 ${category.label} Ticket`)
      .setDescription(
        `Hello ${interaction.user},\nA team member will assist you shortly.\n\n` +
        `**Category:** ${category.label}\n**User:** ${interaction.user.tag}`
      )
      .setColor(category.adminOnly ? '#FF5555' : '#5865F2')
      .setTimestamp()
      .setFooter({ text: category.adminOnly ? 'Only owners can respond.' : 'Support team will respond soon.' });

    // Ping appropriate role or @here
    const pingContent = category.adminOnly
      ? '@here'
      : (supportRole ? `${supportRole}` : '@here');

    await ticketChannel.send({
      content: pingContent,
      embeds: [welcomeEmbed]
    });

    // Notify user
    await interaction.followUp({
      content: `✅ Your ticket has been created: ${ticketChannel.toString()} — please check there.`,
      ephemeral: true
    });

    console.log(`🎟️ Ticket created: #${ticketChannel.name} by ${interaction.user.tag} | Category: ${category.label}`);

  } catch (error) {
    console.error('❌ Ticket creation failed:', error);
    await interaction.followUp({
      content: '❌ Failed to create ticket. Please contact an admin.',
      ephemeral: true
    });
  }
}
