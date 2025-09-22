const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('🚩 Submit an issue or feedback.')
    .addStringOption(option =>
      option.setName('issue')
        .setDescription('Describe the issue or feedback')
        .setRequired(true)),

  async execute(interaction, client, db) {
    const issue = interaction.options.getString('issue');

    try {
      let reportsChannelId = await db.get(`reports_channel_${interaction.guild.id}`);
      let reportsChannel;

      if (!reportsChannelId) {
        reportsChannel = await interaction.guild.channels.create({
          name: 'reports',
          type: 0,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: ['ViewChannel']
            },
            {
              id: interaction.guild.roles.cache.find(r => r.name === 'Admin')?.id || interaction.guild.ownerId,
              allow: ['ViewChannel', 'SendMessages']
            }
          ]
        });

        reportsChannelId = reportsChannel.id;
        await db.set(`reports_channel_${interaction.guild.id}`, reportsChannelId);
      }

      reportsChannel = interaction.guild.channels.cache.get(reportsChannelId);
      if (!reportsChannel) {
        return interaction.reply({ content: '❌ Reports channel not found. Please contact an admin.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle('🚩 New Report')
        .setColor('#ED4245')
        .addFields(
          { name: 'User', value: `${interaction.user} (${interaction.user.id})`, inline: false },
          { name: 'Issue', value: issue, inline: false },
          { name: 'Server', value: interaction.guild.name, inline: true },
          { name: 'Channel', value: `<#${interaction.channelId}>`, inline: true }
        )
        .setTimestamp();

      await reportsChannel.send({ embeds: [embed] });

      await interaction.reply({
        content: '✅ Thank you for your report! Our team will review it shortly.',
        ephemeral: true
      });

    } catch (error) {
      console.error('Report error:', error);
      await interaction.reply({ content: '❌ Failed to submit report.', ephemeral: true });
    }
  }
};
