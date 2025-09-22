const { SlashCommandBuilder } = require('discord.js');

module.exports = {
   new SlashCommandBuilder()
    .setName('remindme')
    .setDescription('⏰ Set a personal reminder.')
    .addStringOption(option =>
      option.setName('time')
        .setDescription('Time (e.g., 5m, 1h, 2d)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('task')
        .setDescription('What to remind you about')
        .setRequired(true)),

  async execute(interaction, client, db) {
    const timeStr = interaction.options.getString('time');
    const task = interaction.options.getString('task');

    try {
      // Parse time
      let durationMs = 0;
      const match = timeStr.match(/^(\d+)([smhd])$/);
      if (!match) {
        return interaction.reply({ content: '❌ Invalid time format. Use: 5m, 1h, 2d', ephemeral: true });
      }

      const amount = parseInt(match[1]);
      const unit = match[2];
      switch (unit) {
        case 's': durationMs = amount * 1000; break;
        case 'm': durationMs = amount * 60 * 1000; break;
        case 'h': durationMs = amount * 60 * 60 * 1000; break;
        case 'd': durationMs = amount * 24 * 60 * 60 * 1000; break;
        default: return interaction.reply({ content: '❌ Invalid time unit.', ephemeral: true });
      }

      if (durationMs > 30 * 24 * 60 * 60 * 1000) { // Max 30 days
        return interaction.reply({ content: '❌ Max reminder time is 30 days.', ephemeral: true });
      }

      await interaction.reply({
        content: `✅ I'll remind you about "${task}" in ${timeStr}.`,
        ephemeral: true
      });

      // Set timeout
      setTimeout(async () => {
        try {
          await interaction.user.send(`⏰ **Reminder**: ${task}\n(Set ${timeStr} ago in ${interaction.guild.name})`)
            .catch(() => {
              // If DMs failed, try to send in channel
              interaction.channel.send(`${interaction.user} ⏰ **Reminder**: ${task}`).catch(() => {});
            });
        } catch (error) {
          console.log('Reminder DM failed:', error);
        }
      }, durationMs);

    } catch (error) {
      console.error('RemindMe error:', error);
      await interaction.reply({ content: '❌ Failed to set reminder.', ephemeral: true });
    }
  }
};
