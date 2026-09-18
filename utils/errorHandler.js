import { EmbedBuilder, MessageFlags } from "discord.js";

/**
 * @param {string} [title]
 * @param {string} [description]
 * @returns {EmbedBuilder}
 */
export function buildErrorEmbed(
  title = "❌ An error occurred",
  description = "Something went wrong. Please try again.",
) {
  return new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(title)
    .setDescription(description);
}

/**
 * Reports an error to the user without ever throwing a second time.
 * Safe to call whether or not the interaction has been deferred or replied to.
 *
 * @param {import("discord.js").Interaction} interaction
 * @param {Error} error
 * @param {Object} [options]
 * @param {string} [options.logPrefix]
 * @param {EmbedBuilder} [options.embed]
 */
export async function replyError(interaction, error, options = {}) {
  console.error(options.logPrefix ?? "Interaction error:", error);

  const embed = options.embed ?? buildErrorEmbed();

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [embed], components: [] });
    } else {
      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (fallbackError) {
    console.error("Failed to report error to user:", fallbackError);
  }
}
