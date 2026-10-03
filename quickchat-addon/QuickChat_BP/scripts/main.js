import { world, system, GameMode } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { CONFIG } from "./config.js";
import { CATEGORIES } from "./messages.js";

const PLAYER_PLACEHOLDER = "{p}";

/** playerId -> 最後に送信した tick */
const lastSentTick = new Map();
/** playerId -> 最近送ったメッセージ（新しい順） */
const recentMessages = new Map();
/** フォームを開いている最中のプレイヤー（二重に開かないように） */
const openForms = new Set();

world.afterEvents.itemUse.subscribe((ev) => {
  if (ev.itemStack?.typeId !== CONFIG.ITEM_ID) return;
  const player = ev.source;
  if (openForms.has(player.id)) return;

  openForms.add(player.id);
  openMainMenu(player)
    .catch((e) => console.warn(`[QuickChat] ${e}`))
    .finally(() => openForms.delete(player.id));
});

world.afterEvents.playerLeave.subscribe((ev) => {
  lastSentTick.delete(ev.playerId);
  recentMessages.delete(ev.playerId);
  openForms.delete(ev.playerId);
});

// ---------- メニュー ----------

async function openMainMenu(player) {
  if (CONFIG.MUTE_TAG && player.hasTag(CONFIG.MUTE_TAG)) {
    player.sendMessage("§c今はクイックチャットを使えません");
    return;
  }

  const form = new ActionFormData()
    .title("§lクイックチャット")
    .body(`§7半径${CONFIG.RANGE}マス以内の人にだけ届きます`);
  const actions = [];

  const recent = recentMessages.get(player.id) ?? [];
  if (recent.length > 0) {
    form.button("§l最近使ったもの", "textures/items/clock_item");
    actions.push(() => openRecentMenu(player, recent));
  }
  for (const category of CATEGORIES) {
    form.button(category.name, category.icon);
    actions.push(() => openCategoryMenu(player, category));
  }
  if (CONFIG.ALLOW_FREE_TEXT) {
    form.button("自由入力", "textures/items/book_writable");
    actions.push(() => openFreeTextForm(player));
  }

  const res = await form.show(player);
  if (res.canceled || res.selection === undefined) return;
  await actions[res.selection]();
}

async function openRecentMenu(player, recent) {
  const form = new ActionFormData().title("§l最近使ったもの");
  for (const text of recent) form.button(text);
  form.button("§l« 戻る");

  const res = await form.show(player);
  if (res.canceled || res.selection === undefined) return;
  if (res.selection >= recent.length) return openMainMenu(player);
  sendQuickChat(player, recent[res.selection]);
}

async function openCategoryMenu(player, category) {
  const form = new ActionFormData().title(category.name);
  for (const template of category.messages) {
    form.button(template.split(PLAYER_PLACEHOLDER).join("§l〇〇§r"));
  }
  form.button("§l« 戻る");

  const res = await form.show(player);
  if (res.canceled || res.selection === undefined) return;
  if (res.selection >= category.messages.length) return openMainMenu(player);

  const template = category.messages[res.selection];
  if (!template.includes(PLAYER_PLACEHOLDER)) {
    sendQuickChat(player, template);
    return;
  }

  const target = await pickPlayer(player, template);
  if (target === "back") return openCategoryMenu(player, category);
  if (target === undefined) return;
  sendQuickChat(player, template.split(PLAYER_PLACEHOLDER).join(`§e${target}§r`));
}

/** @returns {Promise<string | "back" | undefined>} 選んだプレイヤー名 */
async function pickPlayer(player, template) {
  const names = world
    .getAllPlayers()
    .filter((p) => p.id !== player.id)
    .map((p) => p.name)
    .sort((a, b) => a.localeCompare(b));

  if (names.length === 0) {
    player.sendMessage("§c他のプレイヤーがいません");
    return undefined;
  }

  const form = new ActionFormData()
    .title("§lだれのこと？")
    .body(template.split(PLAYER_PLACEHOLDER).join("§l〇〇§r"));
  for (const name of names) form.button(name);
  form.button("§l« 戻る");

  const res = await form.show(player);
  if (res.canceled || res.selection === undefined) return undefined;
  if (res.selection >= names.length) return "back";
  return names[res.selection];
}

async function openFreeTextForm(player) {
  const form = new ModalFormData()
    .title("§l自由入力")
    .textField(`§7半径${CONFIG.RANGE}マス以内に送信（最大${CONFIG.FREE_TEXT_MAX_LENGTH}文字）`, "メッセージを入力");

  const res = await form.show(player);
  if (res.canceled || !res.formValues) return;

  const text = String(res.formValues[0] ?? "")
    .replace(/§./g, "")
    .trim()
    .slice(0, CONFIG.FREE_TEXT_MAX_LENGTH);
  if (text.length === 0) return;
  sendQuickChat(player, text);
}

// ---------- 送信 ----------

function sendQuickChat(sender, text) {
  if (CONFIG.MUTE_TAG && sender.hasTag(CONFIG.MUTE_TAG)) {
    sender.sendMessage("§c今はクイックチャットを使えません");
    return;
  }

  const now = system.currentTick;
  const cooldownTicks = CONFIG.COOLDOWN_SECONDS * 20;
  const last = lastSentTick.get(sender.id);
  if (last !== undefined && now - last < cooldownTicks) {
    const wait = Math.ceil((cooldownTicks - (now - last)) / 20);
    sender.sendMessage(`§cあと${wait}秒待ってください`);
    return;
  }
  lastSentTick.set(sender.id, now);
  rememberRecent(sender.id, text);

  const spectatorIds = new Set(world.getPlayers({ gameMode: GameMode.spectator }).map((p) => p.id));
  const isDead = (p) => p.hasTag(CONFIG.DEAD_TAG) || spectatorIds.has(p.id);
  const senderDead = isDead(sender);

  const prefix = senderDead ? CONFIG.PREFIX_DEAD : CONFIG.PREFIX_ALIVE;
  const line = `${prefix} §f${sender.name}§r: ${text}`;

  const nearby = sender.dimension.getPlayers({ location: sender.location, maxDistance: CONFIG.RANGE });
  let listeners = 0;
  for (const p of nearby) {
    if (p.id === sender.id) continue;
    const listenerDead = isDead(p);
    if (senderDead && !listenerDead) continue; // 死者の声は生存者に届かない
    if (!senderDead && listenerDead && !CONFIG.DEAD_CAN_HEAR_ALIVE) continue;

    p.sendMessage(line);
    if (CONFIG.SOUND) {
      p.playSound(CONFIG.SOUND.id, { volume: CONFIG.SOUND.volume, pitch: CONFIG.SOUND.pitch });
    }
    listeners++;
  }

  sender.sendMessage(line);
  if (listeners === 0 && CONFIG.NOTIFY_NO_LISTENERS) {
    sender.sendMessage("§7（近くに聞こえる人はいませんでした）");
  }
}

function rememberRecent(playerId, text) {
  const list = (recentMessages.get(playerId) ?? []).filter((t) => t !== text);
  list.unshift(text);
  recentMessages.set(playerId, list.slice(0, CONFIG.RECENT_COUNT));
}
