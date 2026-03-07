const SKILL_DEFINITIONS = {
  "natural": [
    {
      "key": "charm",
      "label": "Charm",
      "desc": "This is the ability to get people to like you. It can be used to ingratiate yourself to someone, reduce their hostility to you, enable you to con them or even make them fall in love with you. Characters should use this skill whenever they hope to leave someone else with a better view of them than they started with. This skill usually only works on individuals and small groups; swaying larger groups requires Oratory or Leadership.",
      "complementary": "",
      "defaultCharacteristic": "extrovert"
    },
    {
      "key": "dodge",
      "label": "Dodge",
      "desc": "This encompasses all kinds of different ways of avoiding an attack bobbing and weaving, ducking, leaping over a kick or diving for cover. A successful dodge usually leaves a character about where he was when he made the roll, but players can also specify that their characters end up as far as they like.",
      "complementary": "",
      "defaultCharacteristic": "dexterity"
    },
    {
      "key": "fight",
      "label": "Fight",
      "desc": "Fight represents a character's ability in unarmed hand-to-hand combat. Low levels generally mean a character rarely gets into fights and, when he does, is little more than a brawler. Higher levels imply that a character has fought a lot, had advanced training in the subject, or both. Extensive training in hand-to-hand combat can also mean having the character learn some martial arts (see Combat Actions, under Learned Skills). More detailed rules on Fight are in Chapter Six: Combat.",
      "complementary": "",
      "defaultCharacteristic": "strength"
    },
    {
      "key": "impress",
      "label": "Impress",
      "desc": "While Charm helps a character make other people like her, Impress can have any number of effects on its target. A character might want to scare someone, gain her respect, browbeat her into submission or just make sure she remembers something. This can be a useful skill for getting information out of people, though that sometimes requires torture.",
      "complementary": "",
      "defaultCharacteristic": "extrovert"
    },
    {
      "key": "melee",
      "label": "Melee",
      "desc": "While Fight deals with unarmed combat, Melee takes into account all the hand-to-hand weapons, be they clubs, energy swords, rapiers or poisoned daggers. The most talented characters generally also learn various fencing actions (see Combat Actions, under Learned Skills). The uses of Melee are more fully explored in Chapter Six: Combat.",
      "complementary": "",
      "defaultCharacteristic": "strength"
    },
    {
      "key": "observe",
      "label": "Observe",
      "desc": "Some people stay constantly aware of the world around them, and others have to work at it and still remain oblivious to everything else. The Observe skill generally reflects a person\u00E2\u20AC\u2122s innate sensitivity to the world around him. When she actually tries to see what's going on she should use Inquiry or Search. Thus a sentry would generally need Observe while someone frisking an infiltrator would need Search.",
      "complementary": "",
      "defaultCharacteristic": "perception"
    },
    {
      "key": "shoot",
      "label": "Shoot",
      "desc": "Shoot covers any portable missile weapon that doesn't rely on muscle power. This means muskets, lasers, blasters, assault rifles, flamers, stunners and all sorts of weird alien guns. It does not cover such areas as artillery and most ship or vehicle-mounted guns. For more information on using Shoot, see Chapter Six: Combat.",
      "complementary": "",
      "defaultCharacteristic": "dexterity"
    },
    {
      "key": "sneak",
      "label": "Sneak",
      "desc": "Characters do a lot of things that they don't want other people to notice. Sneak takes that into account, and applies to actions like moving quietly, hiding, using camouflage or slipping past sentries. It almost always applies to physical actions, and attempts to sneak into a computer database require science skills, not Sneak.",
      "complementary": "",
      "defaultCharacteristic": "dexterity"
    },
    {
      "key": "vigor",
      "label": "Vigor",
      "desc": "This skill takes into account many of the physical activities in which people engage. Running, jumping, swimming, climbing, and more all fall into this category. Almost everyone has at least some familiarity with these activities, but most people have not had any real training in them. Characters with more extensive training, and who want to make neat rolls and flips, should buy the Acrobatics learned skill.\n\nSome of the rolls listed here give specific details on how far a character can run, jump or swim, but gamemasters should not feel tied to these. For the most part, Vigor rolls are all or nothing affairs. Either the character leapt from the grav car to the galloping horse or else he fell on his face. The distance guidelines are only there for special circumstances.",
      "complementary": "",
      "defaultCharacteristic": "strength"
    }
  ],
  "learned": [
    {
      "key": "academia",
      "label": "Academia",
      "desc": "This skill allows the character to locate information on a particular topic. This includes knowledge of church libraries, guild records and Second Republic lost libraries (although it is harder to use these). Academia is especially useful for those looking for information on lost tech. Academic research of this sort can often take a great deal of time \u00E2\u20AC\u201D there is no Dewey decimal system to make all this easy. This skill is much easier for those who can read Latin (especially when using a Church library), Urthish or even Urteeth. To obtain information from people, Inquiry \u00E2\u20AC\u201D not Academia \u00E2\u20AC\u201D is the relevant skill.",
      "complementary": "Lore, Read, Sciences",
      "defaultCharacteristic": "wits"
    },
    {
      "key": "acrobatics",
      "label": "Acrobatics",
      "desc": "The study and practice of complex movements of the body, such as flips, cartwheels, etc. This skill also provides a working knowledge of acrobatic actions involving equipment, such as parallel bars and horses. The character also has a superior sense of balance, useful in situations requiring agility or coordination.",
      "complementary": "Stoic Body",
      "defaultCharacteristic": "dexterity"
    },
    {
      "key": "alchemy",
      "label": "Alchemy",
      "desc": "The study of alchemy integrates aspects of chemistry, philosophy and physics into the art and science of matter\u2014its different states, and how one type of matter may be changed into another type. Various elixirs and potions may be concocted, and it is said that the most talented among the Eskatonic Order are able to transform water into wine, among other things.\n\nBut beware\u2014the Inquisition keeps an eye on known alchemists. They claim that alchemy treads too close to the high science of the Second Republic, and that the hubris of a single alchemist can be dangerous to everyone.\n\nAlchemy involves knowledge and understanding of a substance\u2019s spiritual purity and the sympathy it has with other substances\u2014in other words, the spiritual reactions two (or more) substances will have when combined. Alchemists collect catalogs of the correspondences (mystical connections) between substances. They know, for instance, that a toad is impure, and that, when placed near a pure substance, such as a gem, will corrupt that substance, perhaps causing the gem to crack. Why this doesn\u2019t happen all the time is a matter of great debate among alchemists.",
      "complementary": "Focus, Science",
      "defaultCharacteristic": "faith"
    },
    {
      "key": "archery",
      "label": "Archery",
      "desc": "Archery is the study of marksmanship using a bow. While bows are primarily still used for hunting, they are the ranged weapon of choice on some backwater worlds. Characters skilled at Archery may refer to Chapter Seven: Technology for descriptions of different types of bows which they may specialize in (although use of crossbows falls under the skill of the same name).",
      "complementary": "Focus, Ride",
      "defaultCharacteristic": "dexterity"
    },
    {
      "key": "artisan",
      "label": "Artisan",
      "desc": "",
      "complementary": "",
      "defaultCharacteristic": "wits"
    },
    {
      "key": "arts",
      "label": "Arts",
      "desc": "",
      "complementary": "Focus, Lore",
      "defaultCharacteristic": "introvert"
    },
    {
      "key": "beastLore",
      "label": "Beast Lore",
      "desc": "Beast Lore allows the training of animals and an understanding of how they will react in the wild. Characters skilled at Beast Lore know the ways of animals as well or better than the ways of their own people. Often characters with high scores in Beast Lore are more at home with animals than they are with members of their own race, and are considered uncouth by their peers.\n\nBeast Lore also grants the character skill with training animals. While training domesticated animals (such as ferrets, cats and the gentle shazzles of Vera Cruz) is easier, characters may also work with wild animals. Their understanding of the animal\u2019s habits and instincts make it much easier for them to anticipate what the animal is going to do.",
      "complementary": "",
      "defaultCharacteristic": "wits"
    },
    {
      "key": "bureaucracy",
      "label": "Bureaucracy",
      "desc": "Although it is usually possessed by those who work within \u201Cthe system\u201D, whether the setting is the Church, the merchant guilds or the nobility, knowledge of how to manipulate the network of forms and records can be useful to any character. The ability to cut through red tape\u2014or, conversely, to cover your tracks through an endless maze of paperwork\u2014can be invaluable to anyone seeking to circumvent the establishment.",
      "complementary": "Art, Lore",
      "defaultCharacteristic": "wits"
    },
    {
      "key": "disguise",
      "label": "Disguise",
      "desc": "A useful skill for anyone who wishes to change his identity, Disguise can effectively alter the appearance of a character. This skill is easier against serfs and others outside the group you\u2019re trying to impersonate, as many people recognize uniforms more so than the people behind them.\n\nWhen making a Disguise roll, keep track of the number of successes. When someone tries to see past a disguise, roll Perception + Observe and compare the successes to the Disguise roll\u2019s successes. If the suspicious observer wins, he sees through the disguise; otherwise, he\u2019ll probably take the disguised person on his word.",
      "complementary": "Physick, Social (Acting)",
      "defaultCharacteristic": "perception"
    },
    {
      "key": "drive",
      "label": "Drive",
      "desc": "Characters who possess the Drive skill are able to drive a given type of vehicle. In addition, this skill includes knowledge of common traffic rules and the most basic knowledge of how to temporarily repair common problems (such as flat tires on ground vehicles). Anything more complicated will require the Tech Redemption skill.\n\nWhen taking Drive skill, players must choose a particular category of vehicle that the character is familiar with. Furthermore, players may choose, at the gamemaster\u2019s option, to specify a particular type of vehicle (i.e.: skimmer) within a category (Landcraft).",
      "complementary": "",
      "defaultCharacteristic": "dexterity"
    },
    {
      "key": "empathy",
      "label": "Empathy",
      "desc": "Empathy is the ability to sense what another person is feeling by \u201Creading\u201D him for non-verbal cues. A person\u2019s stance, mannerisms and other body language can indicate his emotional state, and may help a character to determine if a subject is lying.\n\nThis skill may not be used to read the attitudes of aliens; that requires the Xeno-Empathy skill (see below).",
      "complementary": "Inquiry, Lore (Folk)",
      "defaultCharacteristic": "perception"
    },
    {
      "key": "etiquette",
      "label": "Etiquette",
      "desc": "Every social group has unwritten rules of behavior, and outsiders unfamiliar with this code are likely to have a correspondingly more difficult time doing anything from getting directions to performing delicate negotiations. Lack of this skill may cause a character to unknowingly commit a dreadful faux pas, causing her ejection from the castle or any number of worse fates.",
      "complementary": "Science (Anthropology), Charm, Knavery",
      "defaultCharacteristic": "wits"
    },
    {
      "key": "focus",
      "label": "Focus",
      "desc": "The ability to attain a deep concentration or focus can aid nearly any character, though it is most often possessed by those who are also skilled at prayer or occult powers.\n\nFocus is required for meditation, but it may also be used to aid in long or deliberate tasks, such as studying for a test or aiming a sniper rifle. In order to focus for such a task, the character must spend five minutes or more meditating; if less time is taken, use the guidelines under Steady Hand (see the description for the Calm characteristic, earlier in this chapter).\n\nWhen using Focus as a complementary skill, the amount of modifiers it adds to the primary skill is also the amount subtracted from any Perception rolls that character makes while focused (except for the primary skill).",
      "complementary": "Arts, Performance, Stoic Mind",
      "defaultCharacteristic": "introvert"
    },
    {
      "key": "gambling",
      "label": "Gambling",
      "desc": "Knowledge of the Gambling skill includes rules of play for the most popular games of chance, and usually includes the most common means of cheating at said games. Though characters from nearly any walk of life may understand the basics of gambling, the Scravers are known far and wide for their skill at games of chance and deception.",
      "complementary": "Observe, Sleight of Hand",
      "defaultCharacteristic": "wits"
    },
    {
      "key": "inquiry",
      "label": "Inquiry",
      "desc": "Inquiry covers the footwork side of investigation, unlike Academia (the paper pusher\u2019s version of this skill).\n\nThe essence of Inquiry is the ability to obtain and correctly interpret information. Any character who engages in any sort of detective work, searching for the tell-tale clues that will indicate what happened at a scene, will find this skill invaluable.\n\nInquiry also includes knowing what questions to ask a suspect, as well as how to interpret what he does\u2014and doesn\u2019t\u2014tell you. Inquisitors of Temple Avesti sometimes possess Inquiry, though they often tend to bully their way through the interrogation process rather than using subtlety.",
      "complementary": "Observe, Lore (any), Science (any)",
      "defaultCharacteristic": "wits"
    },
    {
      "key": "knavery",
      "label": "Knavery",
      "desc": "The art of fast-talking one\u2019s way into (or out of) a situation, or simply flat-out lying in a convincing manner. By using a combination of natural charm, verbal misdirection and all-out chutzpah, a character can attempt to bamboozle a target into believing almost anything from \u201CYou don\u2019t need to see his identification\u201D to \u201CYes, I really will look younger and sexier if I wear one of these fine hats\u201D.",
      "complementary": "Charm, Empathy",
      "defaultCharacteristic": "extrovert"
    },
    {
      "key": "lockpicking",
      "label": "Lockpicking",
      "desc": "Locks come in a variety of different styles in the Known Worlds, and only a character skilled at manipulating them will have much luck in opening them. While many locks can be circumvented by simply shooting them off, this attracts undue attention and simply is not stylish at all. To pull off a heist quickly and quietly requires that a character be able to utilize more subtle means to achieve her goals.\n\nNote that without the proper tools, Lockpicking is far more difficult. Characters who find themselves faced with locks on a regular basis would be well advised to keep their tools on them at all times. Characters who are skilled at manipulating tech locks will find that the necessary tools are often expensive. See Chapter Seven: Technology for more details on locks.",
      "complementary": "Artisan, Tech Redemption (Mech Redemption)",
      "defaultCharacteristic": "dexterity"
    },
    {
      "key": "lore",
      "label": "Lore",
      "desc": "Lore is a general category, and requires a specialization. Characters skilled at a particular Lore are familiar with the facts, theories and stories associated with it, as well as the particular sub-culture interested in similar things.",
      "complementary": "",
      "defaultCharacteristic": "wits"
    },
    {
      "key": "performance",
      "label": "Performance",
      "desc": "Characters with the Performance skill are able to dance, perform music or otherwise use Arts skills in a public setting. There\u2019s always call for a bard at the local lord\u2019s mansion or the tavern. But the bard better be good, or he may wind up contemplating his poor wit in the dungeon or while washing the splattered dirt stains off his tunic. Alliances have begun (and ended) as a result of many such performances. The great Ur-Obun poet Shanor vo Kirn is said to have caused an Ur-Ukar ambassador to weep \u2014 no mean feat \u2014 after hearing his moving tribute to those who fell in defense of the HanKavak citadel.\n\nA character can perform many types of arts, such as Lute, Dance, Sing, Storytelling, etc., but each she must buy each one as a separate skill.\n\nThe Universal Performance Society (UPS) is active in bringing greater understanding between the disparate groups in the Known Worlds through the arts. This movement was begun by Alicia Decados, who, much to her family\u2019s dismay, spent several years training with the famed Vorox dancer Shali-brandor. The reinterpretation of dance that followed was the first of many cultural explosions, bringing a greater understanding between all peoples.",
      "complementary": "Arts, Focus",
      "defaultCharacteristic": "extrovert"
    },
    {
      "key": "physick",
      "label": "Physick",
      "desc": "Physick covers anatomy, surgery, diseases and preventative medicine. This may also include the implantation of cybernetic devices, if the character also has that knowledge. Sanctuary Aeon and the Engineers guild are well known for particular specialties.\n\nCharacters wishing to use Physick on members of a race other than their own must first make a successful Wits + Xenobiology roll, or they will not be sufficiently familiar with how that particular race\u2019s physiology works. Any character likely to encounter aliens in her medical practice would be well advised to bone up on the similarities and differences in biological systems. After all, certain assumptions may lead to the death of the patient.",
      "complementary": "Remedy, Science",
      "defaultCharacteristic": "wits"
    },
    {
      "key": "remedy",
      "label": "Remedy",
      "desc": "Although not as all-encompassing as Physick, Remedy provides the all-important first aid that is usually necessary to sustain a character until help arrives. Remedy also includes an understanding of how to administer aid from a MedPak, including the popular tissue regenerative drug, Elixir. Sanctuary Aeon requires that all initiates learn something of Remedy, but many other groups and individuals possess some knowledge to greater or lesser degrees.\n\nWithin 10 minutes after a wound has been inflicted, a character can attempt or receive first aid to prevent the wound from worsening. This requires a Wits + Remedy roll; if successful, the injured character heals one Vitality level immediately. If the paramedic rolled a critical success, two levels are healed. (See Vitality, later in this chapter.)",
      "complementary": "Physick",
      "defaultCharacteristic": "wits"
    },
    {
      "key": "ride",
      "label": "Ride",
      "desc": "The Ride skill allows characters to effectively control riding beasts, such as horses, llamas and other genetically similar creatures. To control beasts of burden the Drive skill is normally used.",
      "complementary": "Beast Lore",
      "defaultCharacteristic": "dexterity"
    },
    {
      "key": "science",
      "label": "Science",
      "desc": "The study of science can be invaluable to characters in a variety of different situations. Because each type of science is a fairly broad category in and of itself, players should choose one or two types of science to specialize in.",
      "complementary": "",
      "defaultCharacteristic": "wits"
    },
    {
      "key": "search",
      "label": "Search",
      "desc": "This skill allows a character to conduct a methodical search of an area for hidden or concealed objects, doors or compartments. Search can also include frisking someone for concealed weapons or other objects. Characters skilled at Search have a sharp eye for the best hiding places, either from experience at hiding or at finding things. Members of Temple Avesti are known for their unwavering attention to detail when it comes to searching.",
      "complementary": "Observe, Sneak",
      "defaultCharacteristic": "perception"
    },
    {
      "key": "sleightOfHand",
      "label": "Sleight Of Hand",
      "desc": "A skill normally associated with charlatans and street entertainers, Sleight of Hand is also useful for anyone wishing to hide small objects, including small weapons. Sleight of Hand does not usually involve actually concealing an object so much as misdirecting the attention of any observers. This skill can also be used to remove small objects from another individual\u2019s person.",
      "complementary": "Knavery",
      "defaultCharacteristic": "dexterity"
    },
    {
      "key": "social",
      "label": "Social",
      "desc": "Each of the following skills are actually separate skills (and must be bought individually) that fall under the Social heading. Though all of these skills are somewhat related in that they deal with social interactions, they are each unique in their approach. For example: a church leader could use Oratory to sway a crowd but could not keep good control over them if she did not have good Leadership skill, once the initial effects of her speech wore off.\n\nAll the noble houses have tutors to instruct youngsters on social graces, but the Reeves guild also contains many people who put the average noble to shame.\n\nEach of these sub-skills has its own roll and complementary skills associated with it.",
      "complementary": "",
      "defaultCharacteristic": "extrovert"
    },
    {
      "key": "stoicBody",
      "label": "Stoic Body",
      "desc": "The study of Stoic Body is long and arduous, and not for the faint of heart. Still, many believe that the results are well worth the years of training required. Characters skilled at Stoic Body may ignore pain, hunger, sleep deprivation and torture. They can sometimes govern their normally involuntary activities, such as breathing and blinking.",
      "complementary": "Focus",
      "defaultCharacteristic": "calm"
    },
    {
      "key": "stoicMind",
      "label": "Stoic Mind",
      "desc": "Like Stoic Body, the study of Stoic Mind requires intense training that often takes years of a character\u2019s life. It includes the ability to resist occult powers, especially telepathic or empathic intrusion or persuasion. It also allows a character to mask her aura, and at higher levels to project an illusory aura. More details can be found under Occult Powers, in Chapter Four.",
      "complementary": "Focus",
      "defaultCharacteristic": "calm"
    },
    {
      "key": "streetwise",
      "label": "Streetwise",
      "desc": "The character is familiar with underworld and criminal activities. Characters with Streetwise often have lived in the \u201Cwrong\u201D section of town, and have picked up a number of related skills and knowledges just to get by. This skill may be used to contact the criminal underworld or acquire illegal goods or services, including black-market items. While any character familiar with life on the streets may have Streetwise, it is nearly always found in members of the Scravers and Chainers guilds.",
      "complementary": "Lore (Region), Speak (Language)",
      "defaultCharacteristic": "wits"
    },
    {
      "key": "survival",
      "label": "Survival",
      "desc": "The character is skilled at surviving in adverse conditions\u2014generally wild places far from civilization. This includes knowledge of how to improvise makeshift shelters, identify edible plants, trap and fish.",
      "complementary": "Beast Lore, Lore (terrian), Shoot or Archery, Tracking",
      "defaultCharacteristic": "wits"
    },
    {
      "key": "techRedemption",
      "label": "Tech Redemption",
      "desc": "Any character who possesses the Tech Redemption skill should choose a specialty, as there are considerable differences between repairing the sole of a shoe and a think machine. In some cases, more than one Tech Redemption skill may be needed to fix a particularly complicated device. While it is most common among the Engineers guild, there are many among the Charioteers and Scravers guilds, as well as some independents, who possess an understanding of Tech Redemption.",
      "complementary": "",
      "defaultCharacteristic": "tech"
    },
    {
      "key": "thinkMachine",
      "label": "Think Machine",
      "desc": "One of the great achievements of the Second Republic was the invention of vastly powerful computers and artificial intelligence devices. After the Fall, many of these miraculous fonts of information were destroyed, either by Church inquisitors or peasants fearful and misunderstanding of a machine which thinks. Eventually, guildsmen and wealthy nobles began to build computers again, now called \u201Cthink machines.\u201D In addition, those ancient computers which survived were brought back into use. However, current operating systems (and there are many) differ from Second Republic ones, making it much harder to retrieve ancient data.\n\nThe think machine is a contraption largely incomprehensible to the average layman. Some have unlocked the mysteries of these ancient computers, and anyone skilled at using them will certainly be looked upon with awe\u2014and more than a little distrust\u2014by those who aren\u2019t.\n\nThink Machine skill is a rare ability found most often in members of guilds such as the Engineers and Charioteers, and it allows a character to access and use computers. Accessing information and simple programming are possible. Some members of house al-Malik are also said to know some of the mysteries of think machines, though they keep whatever knowledge they have secret.\n\nThe Vau have their own computers, vastly different from Known World machines. A special skill is required to use them, but it is nigh impossible to find a teacher for this skill.",
      "complementary": "Read Urthtech, Science (Think Machine)",
      "defaultCharacteristic": "tech"
    },
    {
      "key": "throwing",
      "label": "Throwing",
      "desc": "Knives, throwing stars, darts and even rocks fall into the category of thrown weapons, and only characters experienced with them will have much luck in hitting their targets. Most folks can fling a rock at someone (roll Dexterity + Vigor), but to throw an object with an edge requires Throwing skill. Otherwise, the target may get hit with the butt of the handle or the flat of the blade, delivering negligible damage.\n\nSome throwing weapons are small enough that a character can fit more than one in his throwing hand (throwing stars, darts, etc.). A character will suffer a -1 penalty to his goal roll for each extra weapon in his hand. See the Weapons Chart in Chapter Six: Combat for further details.",
      "complementary": "",
      "defaultCharacteristic": "dexterity"
    },
    {
      "key": "torture",
      "label": "Torture",
      "desc": "Considered distasteful by some, a normal business practice by others and an art form by still others, Torture is a means of extracting information from an individual by causing physical or mental pain and discomfort. Torture is still a commonly used method of obtaining information, particularly by Inquisitors. This means of information extraction is most commonly used on serfs and freemen without alliances to protect them. Temple Avesti, the Muster and the Reeves are among some of the groups most skilled at Torture.",
      "complementary": "Empathy, Physick",
      "defaultCharacteristic": "wits"
    },
    {
      "key": "tracking",
      "label": "Tracking",
      "desc": "The Tracking skill is often possessed by hunters and rangers, but some bounty hunters and Inquisitors have it as well. Characters skilled at Tracking are able to track their prey through the wilderness by following tell-tale signs of their passing.",
      "complementary": "Lore (terrain)",
      "defaultCharacteristic": "perception"
    },
    {
      "key": "warfare",
      "label": "Warfare",
      "desc": "This skill is a general category which covers several aspects of warfare, from knowledge of tactics to the actual use of engines of war.",
      "complementary": "",
      "defaultCharacteristic": "wits"
    },
    {
      "key": "xenoEmpathy",
      "label": "Xeno Empathy",
      "desc": "Characters with this skill are able to determine an alien\u2019s emotional status by interpreting non-verbal cues. The player must choose to have Empathy with one of the following races, though this skill may be bought multiple times in order to have Empathy with multiple races. Some of the possible races include:",
      "complementary": "Lore (Xeno)",
      "defaultCharacteristic": "perception"
    }
  ]
};

export const NATURAL_SKILLS_BANK = SKILL_DEFINITIONS.natural.map((entry) => ({ ...entry }));
export const LEARNED_SKILLS_BANK = SKILL_DEFINITIONS.learned.map((entry) => ({ ...entry }));
export const SKILL_DEFINITIONS_BY_KEY = Object.fromEntries(
  [...NATURAL_SKILLS_BANK, ...LEARNED_SKILLS_BANK].map((entry) => [entry.key, { ...entry }])
);
