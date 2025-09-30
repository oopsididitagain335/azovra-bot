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

const SUPPORT_ROLE_ID = '1419695081954349076'; // Fixed Support Role ID

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client, db) {
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_category_select')) {
      await handleTicketCreation(interaction, client, db);
    }

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
// 🚀 FASTEST TICKET CREATION WITH AUTO-CATEGORY
// ================

async function handleTicketCreation(interaction, client, db) {
  const categoryId = interaction.values[0];
  const categoryConfig = ticketCategories.categories.find(c => c.value === categoryId);

  if (!categoryConfig) {
    return interaction.reply({ content: '❌ Invalid category.', ephemeral: true });
  }

  // ACKNOWLEDGE IMMEDIATELY
  await interaction.deferUpdate();

  const guild = interaction.guild;
  if (!guild) return;

  // ✅ GET FIXED SUPPORT ROLE
  const supportRole = guild.roles.cache.get(SUPPORT_ROLE_ID);
  if (!supportRole) {
    return interaction.followUp({
      content: `❌ The configured Support Role (ID: ${SUPPORT_ROLE_ID}) was not found in this server.`,
      ephemeral: true
    });
  }

  // 🗂️ CREATE "🎟️ Tickets" CATEGORY (if missing)
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
      console.log(`✅ Created Ticket Category: ${ticketCategory.name}`);
    } catch (error) {
      console.error('❌ Failed to create Ticket Category:', error.message);
      return interaction.followUp({
        content: '❌ Bot lacks permission to create categories.',
        ephemeral: true
      });
    }
  }

  // 🎫 CREATE CHANNEL
  let ticketChannel;
  try {
    ticketChannel = await guild.channels.create({
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
          id: supportRole.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        },
        {
          id: client.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        }
      ],
      topic: `Ticket for ${interaction.user.tag} | Category: ${categoryConfig.label}`,
      reason: `Ticket created by ${interaction.user.tag}`
    });
  } catch (error) {
    console.error('❌ Channel creation failed:', error);
    return interaction.followUp({
      content: '❌ Failed to create ticket channel.',
      ephemeral: true
    });
  }

  // 🚨 EMBED + BUTTONS
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

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_claim_${ticketChannel.id}`)
      .setLabel('Claim Ticket')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🙋‍♂️'),
    new ButtonBuilder()
      .setCustomId(`ticket_close_${ticketChannel.id}`)
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒')
  );

  ticketChannel.send({
    content: `<@&${SUPPORT_ROLE_ID}>`, // 🔔 Ping support role instead of @here
    embeds: [welcomeEmbed],
    components: [row]
  }).catch(err => console.error('Failed to send ticket message:', err));

  // NOTIFY USER
  await interaction.followUp({
    content: `✅ Your ticket has been created: ${ticketChannel} — please check there.`,
    ephemeral: true
  });

  console.log(`🎟️ Ticket created: #${ticketChannel.name} by ${interaction.user.tag}`);
}

// ================
// 🔐 CLAIM TICKET — STAFF ONLY
// ================

async function handleClaimTicket(interaction, client, db) {
  const guild = interaction.guild;
  if (!guild) return;

  const supportRole = guild.roles.cache.get(SUPPORT_ROLE_ID);
  if (!supportRole) {
    return interaction.reply({
      content: '❌ Support role not found in this server.',
      ephemeral: true
    });
  }

  const isSupport = interaction.member.roles.cache.has(SUPPORT_ROLE_ID);
  const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

  if (!isSupport && !isAdmin) {
    return interaction.reply({
      content: '⛔ Only Support Team or Admins can claim tickets.',
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

  const currentTopic = channel.topic || '';
  if (!currentTopic.includes('| Claimed by:')) {
    await channel.setTopic(`${currentTopic} | Claimed by: ${interaction.user.tag}`).catch(() => {});
  }

  // Announce claim in channel
  await channel.send({
    content: `🙋‍♂️ This ticket has been claimed by ${interaction.user}.`
  });
}

// ================
// 🚪 CLOSE TICKET — ANYONE
// ================

async function handleCloseTicket(interaction, client, db) {
  await interaction.deferUpdate();

  const channelId = interaction.customId.split('_')[2];
  const channel = await client.channels.fetch(channelId).catch(() => null);

  if (!channel) {
    return interaction.followUp({
      content: '❌ Ticket channel not found.',
      ephemeral: true
    });
  }

  // ✅ Announce closure in channel before deleting
  await channel.send({
    content: `🔒 Ticket closed by ${interaction.user.tag}. This channel will be deleted shortly...`
  });

  setTimeout(() => {
    channel.delete('Ticket closed by user request').catch(() => {});
  }, 3000);
}
