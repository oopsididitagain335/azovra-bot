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
// 🎫 HANDLE TICKET CREATION
// ================

async function handleTicketCreation(interaction, client, db) {
  const categoryId = interaction.values[0];
  const categoryConfig = ticketCategories.categories.find(c => c.value === categoryId);

  if (!categoryConfig) {
    return interaction.reply({ content: '❌ Invalid category.', ephemeral: true });
  }

  await interaction.deferUpdate();

  const guild = interaction.guild;
  if (!guild) return;

  // 🔑 Hardcoded Support Team Role ID
  const supportRoleId = '1419695081954349076';
  const supportRole = guild.roles.cache.get(supportRoleId);

  if (!supportRole) {
    return interaction.followUp({
      content: '❌ Support Team role (ID: 1419695081954349076) not found in this server.',
      ephemeral: true
    });
  }

  // 🗂️ Ensure "🎟️ Tickets" category exists
  let ticketCategory = guild.channels.cache.find(ch => ch.type === 4 && ch.name === '🎟️ Tickets');
  if (!ticketCategory) {
    try {
      ticketCategory = await guild.channels.create({
        name: '🎟️ Tickets',
        type: 4, // GUILD_CATEGORY
        permissionOverwrites: [
          { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
          { id: supportRoleId, allow: [PermissionFlagsBits.ViewChannel] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel] }
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

  // 🔍 Is this a "Contact Owners" (admin-only) ticket?
  const isAdminTicket = categoryConfig.adminOnly === true;

  // 🎫 Build permission overwrites
  const overwrites = [
    // Everyone denied
    { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
    // Ticket creator
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    },
    // Bot
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    }
  ];

  if (isAdminTicket) {
    // 🔒 Admin ticket: ONLY creator + admins + bot
    // → Do NOT add support role
    // Admins can still view because they have implicit ViewChannel in all channels (unless denied, which we don't do)
  } else {
    // 👥 Regular ticket: allow Support Team
    overwrites.push({
      id: supportRoleId,
      allow: [PermissionFlagsBits.ViewChannel]
    });
  }

  // 🎯 Create ticket channel
  let ticketChannel;
  try {
    ticketChannel = await guild.channels.create({
      name: `${categoryConfig.value}-${interaction.user.username}`.substring(0, 99),
      type: 0, // GUILD_TEXT
      parent: ticketCategory.id,
      permissionOverwrites: overwrites,
      topic: `Ticket for ${interaction.user.tag} | Category: ${categoryConfig.label}${isAdminTicket ? ' | 🔐 Admin Only' : ''}`,
      reason: `Ticket created by ${interaction.user.tag}`
    });
  } catch (error) {
    console.error('❌ Channel creation failed:', error);
    return interaction.followUp({
      content: '❌ Failed to create ticket channel.',
      ephemeral: true
    });
  }

  // 📩 Send welcome message
  const welcomeEmbed = new EmbedBuilder()
    .setTitle(`🎫 ${categoryConfig.label} Ticket${isAdminTicket ? ' (Admin Only)' : ''}`)
    .setDescription(
      `**User:** ${interaction.user}\n` +
      `**Category:** ${categoryConfig.label}\n` +
      (isAdminTicket
        ? '🔒 **This ticket is only visible to server administrators.**\n'
        : '👥 **Visible to Support Team.**\n') +
      `\n> A team member will assist you shortly.`
    )
    .setColor(isAdminTicket ? '#FF5555' : '#5865F2')
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

  // Ping support only for non-admin tickets
  const ping = isAdminTicket ? '' : `<@&${supportRoleId}>`;

  ticketChannel.send({
    content: ping,
    embeds: [welcomeEmbed],
    components: [row]
  }).catch(err => console.error('Failed to send ticket message:', err));

  await interaction.followUp({
    content: `✅ Your ticket has been created: ${ticketChannel} — please check there.`,
    ephemeral: true
  });

  console.log(`🎟️ Ticket created: #${ticketChannel.name} by ${interaction.user.tag} ${isAdminTicket ? '[ADMIN]' : ''}`);
}

// ================
// 🙋 CLAIM TICKET
// ================

async function handleClaimTicket(interaction, client, db) {
  const guild = interaction.guild;
  if (!guild) return;

  const supportRoleId = '1419695081954349076';
  const supportRole = guild.roles.cache.get(supportRoleId);
  if (!supportRole) {
    return interaction.reply({ content: '❌ Support role not found.', ephemeral: true });
  }

  const isSupport = interaction.member.roles.cache.has(supportRoleId);
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
    return interaction.followUp
