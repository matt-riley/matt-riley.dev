const values = {
  lights: ["day", "after-hours"],
  cat: ["off", "on"],
  sound: ["off", "on"],
  view: ["catalogue", "gallery"],
} as const;

export type SettingKey = keyof typeof values;
export type SettingValue<K extends SettingKey> = (typeof values)[K][number];

const defaults = {
  lights: matchMedia("(prefers-color-scheme: dark)").matches
    ? "after-hours"
    : "day",
  cat: "on",
  sound: "off",
  view: "gallery",
} as const;

export function get<K extends SettingKey>(key: K): SettingValue<K> {
  const value = document.documentElement.dataset[key];
  return (
    (values[key] as readonly string[]).includes(value ?? "")
      ? value
      : defaults[key]
  ) as SettingValue<K>;
}

function apply<K extends SettingKey>(key: K, value: SettingValue<K>) {
  document.documentElement.dataset[key] = value;
  document.dispatchEvent(
    new CustomEvent("mr:setting", { detail: { key, value } }),
  );
}

export function set<K extends SettingKey>(key: K, value: SettingValue<K>) {
  if (!(values[key] as readonly string[])?.includes(value)) {
    throw new RangeError(`Invalid ${key} setting: ${value}`);
  }
  try {
    localStorage.setItem(`mr-${key}`, value);
  } catch {
    // The DOM remains usable when browser storage is unavailable.
  }
  apply(key, value);
}

export function toggle<K extends SettingKey>(key: K) {
  const [first, second] = values[key];
  set(key, get(key) === first ? second : first);
}

window.addEventListener("storage", (event) => {
  if (event.storageArea && event.storageArea !== localStorage) return;
  const keys =
    event.key === null ? Object.keys(values) : [event.key.replace(/^mr-/, "")];
  if (event.key !== null && !event.key.startsWith("mr-")) return;
  for (const key of keys) {
    if (!Object.hasOwn(values, key)) continue;
    const setting = key as SettingKey;
    const saved = event.key === null ? null : event.newValue;
    const value = (values[setting] as readonly string[]).includes(saved ?? "")
      ? saved
      : defaults[setting];
    apply(setting, value as SettingValue<typeof setting>);
  }
});
