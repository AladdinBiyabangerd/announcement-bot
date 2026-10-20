export const SOURCES = {
  BINA_AZ: { name: "BINA_AZ", alias: "bina", label: "bina.az", baseUrl: "https://bina.az" },
  TAP_AZ: { name: "TAP_AZ", alias: "tap", label: "tap.az", baseUrl: "https://tap.az" },
  EV10_AZ: { name: "EV10_AZ", alias: "ev10", label: "ev10.az", baseUrl: "https://ev10.az" },
  YENIEMLAK_AZ: {
    name: "YENIEMLAK_AZ",
    alias: "yeniemlak",
    label: "yeniemlak.az",
    baseUrl: "https://yeniemlak.az",
  },
  EMLAK_AZ: { name: "EMLAK_AZ", alias: "emlak", label: "emlak.az", baseUrl: "https://emlak.az" },
  ARENDA_AZ: { name: "ARENDA_AZ", alias: "arenda", label: "arenda.az", baseUrl: "https://arenda.az" },
  EVV_AZ: { name: "EVV_AZ", alias: "evv", label: "evv.az", baseUrl: "https://www.evv.az" },
  UNVAN_AZ: { name: "UNVAN_AZ", alias: "unvan", label: "unvan.az", baseUrl: "https://unvan.az" },
  LALAFO_AZ: { name: "LALAFO_AZ", alias: "lalafo", label: "lalafo.az", baseUrl: "https://lalafo.az" },
  BINATAP_AZ: {
    name: "BINATAP_AZ",
    alias: "binatap",
    label: "binatap.az",
    baseUrl: "https://binatap.az",
  },
};

export const DEFAULT_SOURCE_ALIASES = Object.values(SOURCES)
  .map((source) => source.alias)
  .join(",");

export function sourceFromAlias(raw) {
  if (!raw) {
    return null;
  }
  const normalized = raw.trim().toLowerCase();
  return (
    Object.values(SOURCES).find(
      (source) =>
        source.alias === normalized ||
        source.label === normalized ||
        source.name.toLowerCase() === normalized,
    ) || null
  );
}

export function parseSourceSet(raw) {
  const sources = new Map();
  for (const part of String(raw || "").split(",")) {
    const source = sourceFromAlias(part);
    if (source) {
      sources.set(source.name, source);
    }
  }
  if (sources.size === 0) {
    for (const source of Object.values(SOURCES)) {
      sources.set(source.name, source);
    }
  }
  return [...sources.values()];
}

export function formatSourceLabels(raw) {
  return parseSourceSet(raw)
    .map((source) => source.label)
    .join(", ");
}
