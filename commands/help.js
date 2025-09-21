const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// Helper: recursively get all .js files in subdirs
function getCommandFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && file !== 'node_modules') {
      // Skip help.js folder if somehow created, and node_modules
      results = results.concat(getCommandFiles(filePath));
    } else if (file.endsWith('.js') && file !== 'help.js') {
      results.push(filePath);
    }
  });
  return results;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('📘 View all commands with categories'),

  async execute(interaction, client, db) {
    const commandsPath = path.join(__dirname);
    const commandFiles = getCommandFiles(commandsPath);

    // Group commands by folder/category
    const categories = {};

    for (const filePath of commandFiles) {
      // Get folder name = category
      const folderName = path.basename(path.dirname(filePath));
      
      // Skip if it's in root (like help.js itself)
      if (folderName === 'commands') continue;

      // Load command to get data
      delete require.cache[require.resolve(filePath)]; // Avoid caching issues
      const command = require(filePath);

      if (!command.data || !command.data.name) continue;

      if (!categories[folderName]) {
        categories[folderName] = [];
      }

      categories[folderName].push({
        name: command.data.name,
        description: command.data.description || 'No description provided.',
        usage: command.data.options?.length ? 'Has options' : 'No options'
      });
    }

    // Create main embed
    const mainEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📚 Command Help Center')
      .setDescription('Select a category below to view commands in that section.')
      .setFooter({ text: 'Built with ❤️ for Azorva By Soldev' })
      .setTimestamp();

    // Create select menu options
    const options = Object.keys(categories).map(category => {
      return new StringSelectMenuOptionBuilder()
        .setLabel(category.charAt(0).toUpperCase() + category.slice(1))
        .setDescription(`View ${categories[category].length} commands`)
        .setValue(category);
    });

    // Add "All Commands" option
    options.unshift(
      new StringSelectMenuOptionBuilder()
        .setLabel('All Commands')
        .setDescription('View every command in one list')
        .setValue('all')
    );

    // Build select menu
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_menu')
      .setPlaceholder('Choose a category...')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    // Send initial message
    await interaction.reply({
      embeds: [mainEmbed],
      components: [row],
      ephemeral: true
    });

    // Create message component collector
    const collector = interaction.channel.createMessageComponentCollector({
      time: 60000 // 60 seconds
    });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: '❌ These buttons are not for you.', ephemeral: true });
      }

      const value = i.values[0];

      let responseEmbed;

      if (value === 'all') {
        // Show all commands
        const allCommands = [];
        for (const [category, cmds] of Object.entries(categories)) {
          allCommands.push(`\n**${category.toUpperCase()}**`);
          cmds.forEach(cmd => {
            allCommands.push(`**/${cmd.name}** — ${cmd.description}`);
          });
        }

        responseEmbed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('📚 All Commands')
          .setDescription(allCommands.join('\n'))
          .setFooter({ text: 'Select a category above for filtered view' });

      } else {
        // Show specific category
        const cmds = categories[value];
        const commandList = cmds.map(cmd => `**/${cmd.name}** — ${cmd.description}`).join('\n');

        responseEmbed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(`📚 ${value.charAt(0).toUpperCase() + value.slice(1)} Commands`)
          .setDescription(commandList || 'No commands found in this category.')
          .setFooter({ text: 'Use /command_name to execute any command' });
      }

      await i.update({
        embeds: [responseEmbed],
        components: [row]
      });
    });

    collector.on('end', async () => {
      // Disable menu after timeout
      const disabledMenu = StringSelectMenuBuilder.from(selectMenu).setDisabled(true);
      const disabledRow = new ActionRowBuilder().addComponents(disabledMenu);

      try {
        await interaction.editReply({
          components: [disabledRow]
        });
      } catch (error) {
        // Message might be deleted or inaccessible
        console.log('Could not disable help menu after timeout.');
      }
    });
  }
};
