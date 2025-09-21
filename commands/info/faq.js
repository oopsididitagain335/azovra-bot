const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('faq')
    .setDescription('❓ Answers common questions.'),

  async execute(interaction, client, db) {
    const faq = `**Frequently Asked Questions** ❓

**Q: How do I get roles?**
A: React to messages in <#ROLE_CHANNEL> or ask staff.

**Q: Where are meeting notes?**
A: Check <#MINUTES_CHANNEL> or use \`/minutes\`.

**Q: How do I submit suggestions?**
A: Use \`/report\` or post in <#SUGGESTIONS_CHANNEL>.

**Q: When are team meetings?**
A: Use \`/agenda\` to see upcoming meetings.

**Q: How do I contact staff?**
A: Use \`/support\` to open a ticket.

**Q: Where can I find project updates?**
A: Use \`/project [name]\` or check <#UPDATES_CHANNEL>.`;

    await interaction.reply({ content: faq, ephemeral: false });
  }
};
