const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  EmbedBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const token = "token";
const clientId = "1280357697094549544";
const guildId = "1161152393224925289";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  const rest = new REST({ version: "9" }).setToken(token);

  try {
    console.log("Refreshing slash commands...");
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: [
        {
          name: "inactive-channels",
          description: "Lists the most inactive channels in the server",
        },
      ],
    });
    console.log("Slash commands refreshed!");
  } catch (error) {
    console.error("Failed to refresh slash commands:", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "inactive-channels") {
    try {
      if (!interaction.guild) {
        console.error(
          "Interaction does not have a guild context:",
          interaction
        );
        await interaction.reply({
          content: "This command can only be used in a server.",
          ephemeral: true,
        });
        return;
      }

      const channels = interaction.guild.channels.cache.filter(
        (channel) => channel.type === ChannelType.GuildText && channel.viewable
      );

      const inactivityData = await Promise.all(
        channels.map(async (channel) => {
          const messages = await channel.messages.fetch({ limit: 1 });
          const lastMessage = messages.first();
          const lastMessageDate = lastMessage
            ? lastMessage.createdAt
            : channel.createdAt;
          return { channel, lastMessageDate };
        })
      );

      inactivityData.sort((a, b) => a.lastMessageDate - b.lastMessageDate);

      // Pagination variables
      const itemsPerPage = 10;
      let page = 0;
      const totalPages = Math.ceil(inactivityData.length / itemsPerPage);

      // Create embed for a specific page
      const generateEmbed = (page) => {
        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const leaderboard = inactivityData
          .slice(start, end)
          .map((data, index) => {
            return `${start + index + 1}. **${
              data.channel.name
            }** - Last activity: ${data.lastMessageDate.toDateString()}`;
          })
          .join("\n");

        return new EmbedBuilder()
          .setTitle(
            `Inactive Channels Leaderboard (Page ${page + 1}/${totalPages})`
          )
          .setDescription(leaderboard || "No inactive channels found.")
          .setColor("#FF0000")
          .setTimestamp();
      };

      // Initial embed
      const embed = generateEmbed(page);

      // Buttons for pagination
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("prev")
          .setLabel("Previous")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("Next")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === totalPages - 1)
      );

      const message = await interaction.reply({
        embeds: [embed],
        components: [row],
        fetchReply: true,
      });

      // Collector to handle button interactions
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000,
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({
            content: "These buttons aren't for you!",
            ephemeral: true,
          });
          return;
        }

        if (i.customId === "prev" && page > 0) {
          page--;
        } else if (i.customId === "next" && page < totalPages - 1) {
          page++;
        }

        const newEmbed = generateEmbed(page);
        const newRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("prev")
            .setLabel("Previous")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId("next")
            .setLabel("Next")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === totalPages - 1)
        );

        await i.update({ embeds: [newEmbed], components: [newRow] });
      });

      collector.on("end", () => {
        // Disable buttons after the collector ends
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("prev")
            .setLabel("Previous")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("next")
            .setLabel("Next")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true)
        );

        message.edit({ components: [disabledRow] });
      });
    } catch (error) {
      console.error("Error handling inactive-channels command:", error);
      await interaction.reply({
        content:
          "An error occurred while retrieving the inactive channels. Please try again later.",
        ephemeral: true,
      });
    }
  }
});

client.login(token).catch((error) => {
  console.error("Failed to log in:", error);
});
