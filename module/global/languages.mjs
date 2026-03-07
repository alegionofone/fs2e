const normalizeLanguageArray = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
};

const uniqueLanguages = (value) => Array.from(new Set(value));

export const collectItemLanguageGrants = (items) => {
  const grantedSpeak = [];
  const grantedRead = [];

  for (const item of items ?? []) {
    const itemLanguages = item.system?.languages ?? item.system?.data?.languages;
    if (!itemLanguages) continue;

    grantedSpeak.push(...normalizeLanguageArray(itemLanguages.speak));
    grantedRead.push(...normalizeLanguageArray(itemLanguages.read));
  }

  return {
    speak: uniqueLanguages(grantedSpeak),
    read: uniqueLanguages(grantedRead)
  };
};

export const aggregateActorLanguages = (actor) => {
  const actorLanguages = actor.system?.languages ?? actor.system?.data?.languages ?? {};
  const manual = actorLanguages.manual ?? {};

  const manualSpeak = normalizeLanguageArray(manual.speak);
  const manualRead = normalizeLanguageArray(manual.read);
  const granted = collectItemLanguageGrants(actor.items);

  const total = {
    speak: uniqueLanguages([...manualSpeak, ...granted.speak]),
    read: uniqueLanguages([...manualRead, ...granted.read])
  };

  actor.system.languages = {
    manual: {
      speak: manualSpeak,
      read: manualRead
    },
    granted,
    total
  };
};
