/**
 * Tests for `/emojis upload` — the command that has to work on a machine we
 * cannot see, so every failure mode is exercised here.
 *
 *   node scripts/check-emojis-command.mjs
 */
import assert from "node:assert/strict";
import { Collection } from "discord.js";

import command, { configSnippet, describeError, listNames } from "../Command/Interactions/emojis.js";
import { EMOJI_GROUPS, allEmojiNames } from "../config/emojiIds.js";

const results = [];
const test = async (name, fn) => {
  try {
    await fn();
    results.push([true, name]);
    console.log(`  ✅ ${name}`);
  } catch (error) {
    results.push([false, name]);
    console.log(`  ❌ ${name}\n     ${error.message}`);
  }
};

/** Fake application emoji manager. */
function fakeManager({ fail = false } = {}) {
  const store = new Map();
  let nextId = 900000000000000000n;

  return {
    store,
    async fetch() {
      const collection = new Collection();
      for (const [id, emoji] of store) collection.set(id, emoji);
      return collection;
    },
    async create({ attachment, name }) {
      if (fail) {
        const error = new Error(fail);
        error.code = 50013;
        throw error;
      }
      if (!attachment || !attachment.length) throw new Error("empty image");
      const id = String(nextId++);
      const emoji = { id, name };
      store.set(id, emoji);
      return emoji;
    },
  };
}

/** Fake guild with an emoji cache of the same shape discord.js uses. */
function fakeGuild({ fail = false } = {}) {
  const cache = new Collection();
  return {
    emojis: {
      cache,
      async create({ name }) {
        if (fail) {
          const error = new Error("Missing Permissions");
          error.code = 50013;
          throw error;
        }
        const id = String(800000000000000000n + BigInt(cache.size));
        cache.set(id, { id, name });
        return { id, name };
      },
    },
  };
}

/** Fake interaction; `editReply` captures what the user would see. */
function fakeInteraction({ upload = true, guild = fakeGuild() } = {}) {
  const replies = [];
  return {
    guild,
    replies,
    deferred: false,
    options: { getBoolean: (key) => (key === "upload" ? upload : null) },
    async deferReply() {
      this.deferred = true;
    },
    async editReply(payload) {
      replies.push(payload);
      return payload;
    },
    get last() {
      return replies.at(-1);
    },
  };
}

const clientWith = (manager) => ({ application: manager ? { emojis: manager } : {}, user: { id: "1" } });

console.log("\nhelpers");
await test("describeError keeps the Discord code", () => {
  const error = new Error("Missing Access");
  error.code = 50001;
  assert.equal(describeError(error), "Missing Access [50001]");
  assert.equal(describeError(new Error("plain")), "plain");
});

await test("listNames truncates long lists", () => {
  assert.equal(listNames([]), "none");
  assert.equal(listNames(["a", "b"]), "a, b");
  assert.ok(listNames(Array.from({ length: 30 }, (_, i) => `n${i}`)).includes("(+18 more)"));
});

await test("the paste block covers every group", () => {
  const snippet = configSnippet(new Map());
  for (const name of [
    "SLOT_EMOJI_IDS",
    "UI_EMOJI_IDS",
    "PROFESSION_EMOJI_IDS",
    "TILE_EMOJI_IDS",
    "DEMO_EMOJI_IDS",
  ]) {
    assert.ok(snippet.includes(`export const ${name} = {`), `${name} missing from the snippet`);
  }
  for (const group of Object.values(EMOJI_GROUPS)) {
    for (const key of Object.keys(group)) assert.ok(snippet.includes(`${key}:`), `${key} missing`);
  }
});

console.log("\nupload");
await test("uploads every PNG through application emojis", async () => {
  const manager = fakeManager();
  const interaction = fakeInteraction();
  await command.execute(interaction, clientWith(manager));

  const content = interaction.last.content;
  assert.ok(manager.store.size >= 30, `uploaded only ${manager.store.size}`);
  assert.ok(/Uploaded \d+ \(\d+ application, 0 guild\)/.test(content), "the reply should say how it uploaded");
  // The only failures allowed here are names without art, not upload errors.
  assert.ok(!content.includes("Missing Access"), "an upload error leaked through");
  assert.equal(interaction.guild.emojis.cache.size, 0, "nothing should have used the fallback");
});

await test("falls back to guild emojis when application emojis are refused", async () => {
  const manager = fakeManager({ fail: "Missing Access" });
  const interaction = fakeInteraction();
  await command.execute(interaction, clientWith(manager));

  const content = interaction.last.content;
  assert.equal(manager.store.size, 0, "nothing should reach the application");
  assert.ok(interaction.guild.emojis.cache.size >= 30, "the guild fallback did not run");
  assert.ok(/1 guild|guild\)/.test(content) || content.includes("guild"), "reply hides the fallback");
});

await test("works when the client has no application emoji manager at all", async () => {
  const interaction = fakeInteraction();
  await command.execute(interaction, clientWith(null));

  assert.ok(interaction.guild.emojis.cache.size >= 30, "guild upload did not happen");
  assert.ok(interaction.last.content.includes("guild"), "reply should mention the guild route");
});

await test("skips emojis that already exist", async () => {
  const manager = fakeManager();
  await manager.create({ attachment: Buffer.from("x"), name: "slot_empty" });
  const before = manager.store.size;

  const interaction = fakeInteraction();
  await command.execute(interaction, clientWith(manager));

  assert.equal(
    manager.store.size,
    before + allEmojiNames().filter((name) => name !== "slot_empty").length,
    "slot_empty was uploaded twice",
  );
  assert.ok(interaction.last.content.includes("configured"), "no summary");
});

await test("every configured emoji has art, so the run reports no missing PNGs", async () => {
  const manager = fakeManager();
  const interaction = fakeInteraction();
  await command.execute(interaction, clientWith(manager));

  const content = interaction.last.content;
  assert.ok(!content.includes("no PNG in docs/emojis"), "some emoji has no PNG on disk");
  assert.ok(/PNGs found in docs\/emojis: 49\/49/.test(content), "the count is wrong");
  assert.ok(content.includes("Game emojis"), "no summary line");
});

await test("when everything fails the user is told, not left hanging", async () => {
  const manager = fakeManager({ fail: "Missing Access" });
  const interaction = fakeInteraction({ guild: fakeGuild({ fail: "Missing Permissions" }) });
  await command.execute(interaction, clientWith(manager));

  assert.equal(interaction.replies.length, 1, "expected exactly one reply");
  const content = interaction.last.content;
  assert.ok(content.includes("Failed"), "no failure line");
  assert.ok(content.includes("50013"), "the Discord code is missing");
});

await test("a status run (no upload) lists what is missing", async () => {
  const interaction = fakeInteraction({ upload: false });
  await command.execute(interaction, clientWith(fakeManager()));

  assert.equal(interaction.guild.emojis.cache.size, 0, "a status run must not upload");
  const content = interaction.last.content;
  assert.ok(content.includes("Not uploaded yet"), "missing list absent");
  assert.ok(content.includes("config/emojiIds.js"), "no paste instructions");
});

await test("the reply is always a valid message payload", async () => {
  const manager = fakeManager();
  const interaction = fakeInteraction();
  await command.execute(interaction, clientWith(manager));

  const payload = interaction.last;
  assert.ok(typeof payload.content === "string" && payload.content.length > 0);
  assert.ok(payload.content.length <= 2000, "content over Discord's limit");
  if (payload.content.includes("Snippet attached")) {
    assert.ok(Array.isArray(payload.files) && payload.files.length === 1, "snippet file missing");
  }
});

const failed = results.filter(([ok]) => !ok).length;
console.log("\n---------------------------------------------");
if (failed > 0) {
  console.error(`❌ ${failed}/${results.length} emoji-command checks failed`);
  process.exit(1);
}
console.log(`✅ ${results.length} emoji-command checks passed`);
