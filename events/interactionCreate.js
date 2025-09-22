// src/events/interactionCreate.js

const {
  Events,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const ticketCategories = require('../config/ticketCategories.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client, db) {
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_category_select')) {
      await handleTicketCreation(interaction, client, db);
    }

    // Handle Close & Claim Buttons
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('ticket_close')) {
        await handleCloseTicket(interaction, client, db);
      } else if (interaction.customId.startsWith('ticket_claim')) {
        await handleClaimTicket(interaction, client, db);
      }
    }
  }
};

// ================
// TICKET CREATION
// ================

async function handleTicketCreation(interaction, client, db) {
  const categoryId = interaction.values[0];
  const categoryConfig = ticketCategories.categories.find(c => c.value === categoryId);

  if (!categoryConfig) {
    return interaction.reply({ content: '❌ Invalid category.', ephemeral: true });
  }

  await interaction.deferUpdate(); // Acknowledge without reply

  const guild = interaction.guild;
  if (!guild) return;

  // =============
  // CREATE ROLE: "Support Team" (if missing)
  // =============
  let supportRole = guild.roles.cache.find(r => r.name === 'Support Team');
  if (!supportRole) {
    try {
      supportRole = await guild.roles.create({
        name: 'Support Team',
        color: '#5865F2',
        reason: 'Auto-created for ticket system'
      });
      console.log(`✅ Created Support Role: ${supportRole.name} (${supportRole.id})`);
    } catch (error) {
      console.error('❌ Failed to create Support Role:', error.message);
      return interaction.followUp({
        content: '❌ Bot lacks permission to create roles. Contact server owner.',
        ephemeral: true
      });
    }
  }

  // ======================
  // CREATE CATEGORY: "🎟️ Tickets" (if missing)
  // ======================
  let ticketCategory = guild.channels.cache.find(
    ch => ch.type === 4 && ch.name === '🎟️ Tickets'
  );

  if (!ticketCategory) {
    try {
      ticketCategory = await guild.channels.create({
        name: '🎟️ Tickets',
        type: 4, // GUILD_CATEGORY
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: supportRole.id,
            allow: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: client.user.id,
            allow: [PermissionFlagsBits.ViewChannel]
          }
        ],
        reason: 'Auto-created for ticket system'
      });
      console.log(`✅ Created Ticket Category: ${ticketCategory.name} (${ticketCategory.id})`);
    } catch (error) {
      console.error('❌ Failed to create Ticket Category:', error.message);
      return interaction.followUp({
        content: '❌ Bot lacks permission to create categories. Contact server owner.',
        ephemeral: true
      });
    }
  }

  // ====================
  // CREATE TICKET CHANNEL
  // ====================
  try {
    const ticketChannel = await guild.channels.create({
      name: `${categoryConfig.value}-${interaction.user.username}`.substring(0, 99),
      type: 0, // GUILD_TEXT
      parent: ticketCategory.id,
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
      topic: `Ticket for ${interaction.user.tag} | Category: ${categoryConfig.label} | Owner: ${interaction.user.id}`,
      reason: `Ticket created by ${interaction.user.tag}`
    });

    // Grant Support Role (unless adminOnly)
    if (!categoryConfig.adminOnly) {
      await ticketChannel.permissionOverwrites.create(supportRole, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });
    }

    // Grant ALL ADMINS
    const admins = await guild.members.fetch({ force: true });
    const adminMembers = admins.filter(m => m.permissions.has(PermissionFlagsBits.Administrator));

    for (const [id, adminMember] of adminMembers) {
      await ticketChannel.permissionOverwrites.create(adminMember, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });
    }

    // ======================
    // SEND EMBED + BUTTONS — IMMEDIATELY
    // ======================

    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`🎫 ${categoryConfig.label} Ticket`)
      .setDescription(
        `**User:** ${interaction.user}\n` +
        `**Category:** ${categoryConfig.label}\n\n` +
        `> A team member will assist you shortly. Use buttons below to manage this ticket.`
      )
      .setColor(categoryConfig.adminOnly ? '#FF5555' : '#5865F2')
      .setTimestamp()
      .setFooter({ text: 'Thank you for your patience!' });

    // Buttons: Claim + Close
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_claim_${ticketChannel.id}`)
        .setLabel('_claim')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🙋‍♂️'),
      new ButtonBuilder()
        .setCustomId(`ticket_close_${ticketChannel.id}`)
        .setLabel('Close Ticket')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒')
    );

    await ticketChannel.send({
      content: categoryConfig.adminOnly ? '@here' : `${supportRole}`,
      embeds: [welcomeEmbed],
      components: [row]
    });

    // Notify user
    await interaction.followUp({
      content: `✅ Your ticket has been created: ${ticketChannel} — please check there.`,
      ephemeral: true
    });

    console.log(`🎟️ Ticket created: #${ticketChannel.name} by ${interaction.user.tag}`);

  } catch (error) {
    console.error('❌ Ticket creation failed:', error);
    await interaction.followUp({
      content: '❌ Failed to create ticket. Please contact an admin.',
      ephemeral: true
    });
  }
}

// ================
// CLOSE TICKET
// ================

async function handleCloseTicket(interaction, client, db) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.reply({
      content: '⛔ You need **Manage Channels** permission to close tickets.',
      ephemeral: true
    });
  }

  await interaction.deferUpdate();

  const channelId = interaction.customId.split('_')[2];
  const channel = await client.channels.fetch(channelId).catch(() => null);

  if (!channel) {
    return interaction.followUp({
      content: '❌ Ticket channel not found.',
      ephemeral: true
    });
  }

  const transcript = [];
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    messages.reverse().forEach(msg => {
      transcript.push(`[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content}`);
    });
  } catch (err) {
    console.warn('Could not generate transcript:', err.message);
  }

  // Optional: Save transcript to file or DB here

  await channel.delete('Ticket closed by user request');

  await interaction.followUp({
    content: `✅ Ticket #${channel.name} has been closed by ${interaction.user.tag}.`,
    ephemeral: true
  });
}

// ================
// CLAIM TICKET
// ================

async function handleClaimTicket(interaction, client, db) {
  await interaction.deferUpdate();

  const channelId = interaction.customId.split('_')[2];
  const channel = await client.channels.fetch(channelId).catch(() => null);

  if (!channel) {
    return interaction.followUp({
      content: '❌ Ticket channel not found.',
      ephemeral: true
    });
  }

  // Edit channel topic to show claimed status
  const currentTopic = channel.topic || '';
  if (!currentTopic.includes('| Claimed by:')) {
    await channel.setTopic(`${currentTopic} | Claimed by: ${interaction.user.tag}`);
  }

  await interaction.followUp({
    content: `🙋‍♂️ ${interaction.user} has claimed this ticket.`,
    ephemeral: false // Let everyone in ticket see who claimed it
  });
}
