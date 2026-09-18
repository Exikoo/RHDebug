import * as loginHandler from "./_loginHandler.js";
import * as mapHandler from "./_mapHandler.js";

/**
 * Order matters: the first handler whose match() returns true wins.
 * More specific matches should come before broader ones.
 */
const handlers = [loginHandler, mapHandler];

export const name = "interactionCreate";

/**
 * @param {import("discord.js").Interaction} interaction
 * @param {import("discord.js").Client} client
 */
export async function execute(interaction, client) {
  for (const handler of handlers) {
    if (typeof handler.match === "function" && handler.match(interaction)) {
      return handler.execute(interaction, client);
    }
  }
}
