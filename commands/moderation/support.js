const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('support')
    .setDescription('🎫 Opens a support ticket.'),

  async execute(interaction, client, db) {
    try {
      // Ensure Support role exists
      let supportRole = interaction.guild.roles.cache.find(role => role.name === 'Support');
      
      if (!supportRole) {
        // Create Support role if it doesn't exist
        supportRole = await interaction.guild.roles.create({
          name: 'Support',
          color: '#5865F2',
          permissions: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageMessages // Optional: to manage tickets
          ],
          reason: 'Created automatically by /support command'
        });
        
        console.log(`✅ Created "Support" role in ${interaction.guild.name}`);
      }

      // Create ticket channel
      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: 0, // Text channel
        parent: interaction.channel.parentId, // same category if possible
        permissionOverwrites: [
          {
            id: interaction.guild.id, // @everyone
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory
            ]
          },
          {
            id: supportRole.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.ManageMessages
            ]
          }
        ],
        reason: `Support ticket for ${interaction.user.tag}`
      });

      const embed = new EmbedBuilder()
        .setTitle('🎫 Support Ticket Created')
        .setDescription(`Hello ${interaction.user},\n\nA staff member will be with you shortly.\nPlease describe your issue in this channel.`)
        .setColor('#5865F2')
        .setTimestamp();

      await ticketChannel.send({ 
        content: `<@${interaction.user.id}>`, 
        embeds: [embed] 
      });

      // Optional: Also notify Support role members
      await ticketChannel.send({
        content: `${supportRole} — New ticket opened by ${interaction.user}`,
        allowedMentions: { roles: [supportRole.id] }
      }).catch(() => {});

      await interaction.reply({
        content: `✅ Support ticket created: ${ticketChannel}\nPlease check the new channel.`,
        ephemeral: true
      });

    } catch (error) {
      console.error('Support error:', error);
      await interaction.reply({ 
        content: '❌ Failed to create support ticket. Please ensure the bot has Manage Roles and Manage Channels permissions.', 
        ephemeral: true 
      });
    }
  }
};
