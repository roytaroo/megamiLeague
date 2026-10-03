// ===== クイックチャット設定 =====
// ここの値を書き換えると挙動を調整できます。

export const CONFIG = {
  // クイックチャットを開くアイテムのID
  ITEM_ID: "qc:quick_chat",

  // メッセージが届く半径（ブロック数）。VCアドオンの距離に合わせる
  RANGE: 12,

  // 連投防止のクールダウン（秒）
  COOLDOWN_SECONDS: 2,

  // 死亡扱いにするタグ（/tag @s add dead など）。スペクテイターモードも死亡扱い
  // 死亡者のメッセージは近くの死亡者にしか届かない
  DEAD_TAG: "dead",

  // true: 死亡者は生存者のメッセージを聞ける / false: 聞けない
  DEAD_CAN_HEAR_ALIVE: true,

  // このタグが付いている人はクイックチャットを使えない（夜の間など）
  // 例: /tag @a add qc_mute  →  /tag @a remove qc_mute
  MUTE_TAG: "qc_mute",

  // 自由入力（キーボードで文字を打つ）を許可するか
  ALLOW_FREE_TEXT: true,
  FREE_TEXT_MAX_LENGTH: 60,

  // 近くに誰もいなかったとき、送信者に知らせるか
  NOTIFY_NO_LISTENERS: true,

  // 「最近使ったもの」に残す数
  RECENT_COUNT: 5,

  // 受信時の効果音（不要なら null）
  SOUND: { id: "random.orb", volume: 0.4, pitch: 1.6 },

  // チャットの表示形式
  PREFIX_ALIVE: "§a[近く]§r",
  PREFIX_DEAD: "§8[霊界]§r",
};
