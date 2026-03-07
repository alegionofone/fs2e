const CHARACTERISTIC_DEFINITIONS = [
  {
    key: "strength",
    label: "Strength",
    desc: "Muscle power. Strength determines how much weight a character can lift, and helps in athletic tasks like jumping and climbing (see the Vigor skill) or wrestling. Generally, the higher a character's Strength, the bulkier and more muscular she is, but there are exceptions.\n\nA character can lift a certain amount in kilograms over his head per Strength level without needing to make a roll. To lift more than that, he must make a Str + Vigor roll, with a -1 penalty per Str level required above his own, up to a maximum of that allowed for his Str +3 (a Str 4 person can lift 120 kg max). Others can join together to lift items; simply add all allowances together: three Str 3 people can lift 120 kg without needing to roll."
  },
  {
    key: "dexterity",
    label: "Dexterity",
    desc: "Agility and motor control. Dexterity determines how nimble a character is, and helps in combat actions or athletic tasks like running (see the Vigor skill). Generally, the higher a character's Dexterity, the slimmer she is, but there are exceptions."
  },
  {
    key: "endurance",
    label: "Endurance",
    desc: "Stamina and robust health. Endurance determines a character's staying power and ability to stave off disease. Generally, the higher a character's Endurance, the larger she is, although this is not always true. Besides physical health, Endurance also represents a strong will to live or endure beyond the breaking point. Endurance helps determine a character's base Vitality (Endurance +5)."
  },
  {
    key: "wits",
    label: "Wits",
    desc: "Intelligence and quick-thinking. Wits determines how well a character remembers and understands things, and helps in any task involving learning. The higher a character's Wits, the quicker she is at figuring things out and reacting to events."
  },
  {
    key: "perception",
    label: "Perception",
    desc: "Awareness and alertness. Perception determines how aware a character is of the world around her and how well she notices hidden things. The higher a character's Perception, the more observant she is of things other people only notice unconsciously."
  },
  {
    key: "tech",
    label: "Tech",
    desc: "On the Known Worlds, the scientific method is by no means common, even among the learned. Those who have the knack or training to comprehend and utilize - let alone invent - technology are rare and often find their way into positions of power in a guild. The Tech characteristic represents a character's knack at understanding technology; its levels match those given on the Tech Level Chart (see Chapter 7: Technology). Tech aids in repairing broken equipment and in comprehending high-tech devices and sciences."
  },
  {
    key: "extrovert",
    label: "Extrovert",
    desc: "Extrovert and its opposing characteristic, Introvert, represent two extremes of interpersonal relationships. Each person tends towards one or the other, although it is possible for these two characteristics to be in balance. Extroverts reach out for others, preferring social situations to sitting alone in a room. Introverts are more comfortable by themselves than with others, and tend to avoid social situations they cannot control. Neither characteristic implies social ability: An Extrovert may be a nebbish nobody likes but who keeps on butting into conversations, while an Introvert may be the quiet author everybody tries to flock around but who avoids parties. Interpersonal activities (partying, acting) are resolved using Extrovert; 'inner' activities (writing poetry, trying to remember a long-forgotten fact or repressed memory) are resolved using Introvert."
  },
  {
    key: "introvert",
    label: "Introvert",
    desc: "Extrovert and its opposing characteristic, Introvert, represent two extremes of interpersonal relationships. Each person tends towards one or the other, although it is possible for these two characteristics to be in balance. Extroverts reach out for others, preferring social situations to sitting alone in a room. Introverts are more comfortable by themselves than with others, and tend to avoid social situations they cannot control. Neither characteristic implies social ability: An Extrovert may be a nebbish nobody likes but who keeps on butting into conversations, while an Introvert may be the quiet author everybody tries to flock around but who avoids parties. Interpersonal activities (partying, acting) are resolved using Extrovert; 'inner' activities (writing poetry, trying to remember a long-forgotten fact or repressed memory) are resolved using Introvert."
  },
  {
    key: "passion",
    label: "Passion",
    desc: "Passion and its opposing characteristic, Calm, represent two emotional extremes. As with most emotions, they have a tendency to govern a character as much as she governs them. Some people are hotheads (Passion) and find it hard to control their outbursts. Others are laid back (Calm) and may actually find it hard to get very excited about something."
  },
  {
    key: "calm",
    label: "Calm",
    desc: "Passion and its opposing characteristic, Calm, represent two emotional extremes. As with most emotions, they have a tendency to govern a character as much as she governs them. Some people are hotheads (Passion) and find it hard to control their outbursts. Others are laid back (Calm) and may actually find it hard to get very excited about something."
  },
  {
    key: "faith",
    label: "Faith",
    desc: "Faith and its opposing characteristic, Ego, represent two extremes of the soul determining identity. Faith is collective, centered outside the self, looking out or upwards to a spiritual deity for inspiration and meaning. Ego is individualistic, centered in the character's own sense of self (the core of the personal pronoun 'I'), gaining inspiration and meaning mainly from itself (although this does not prevent the character from believing in a deity). Both faithful and egotistical characters can be stubborn and divisive but strong and enduring at the same time.\n\nFaith and Ego are rarely rolled. They are mainly applied when using occult powers or weird Ur artifacts. Most people go through life without ever having their Faith or Ego tested, but entry into the occult dimension often puts one's identity to task."
  },
  {
    key: "ego",
    label: "Ego",
    desc: "Faith and its opposing characteristic, Ego, represent two extremes of the soul determining identity. Faith is collective, centered outside the self, looking out or upwards to a spiritual deity for inspiration and meaning. Ego is individualistic, centered in the character's own sense of self (the core of the personal pronoun 'I'), gaining inspiration and meaning mainly from itself (although this does not prevent the character from believing in a deity). Both faithful and egotistical characters can be stubborn and divisive but strong and enduring at the same time.\n\nFaith and Ego are rarely rolled. They are mainly applied when using occult powers or weird Ur artifacts. Most people go through life without ever having their Faith or Ego tested, but entry into the occult dimension often puts one's identity to task."
  }
];

const CHARACTERISTIC_DEFINITIONS_BY_KEY = Object.fromEntries(
  CHARACTERISTIC_DEFINITIONS.map((entry) => [entry.key, entry])
);

export { CHARACTERISTIC_DEFINITIONS, CHARACTERISTIC_DEFINITIONS_BY_KEY };
