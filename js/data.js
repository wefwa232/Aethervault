/* AETHERVAULT — content registries. Pure data. Add content here (and art in art.js). */
(function () {
  const AV = (window.AV = window.AV || {});

  // ---------- Rarities ----------
  // tier drives reveal choreography; essence/value are base numbers for formulas.
  const RARITIES = [
    { id: 'common',       name: 'Common',       tier: 0, color: '#9fb0cc', glow: '#6e82a8', glyph: '<circle cx="12" cy="12" r="6.5"/>',                                  essence: 8,    value: 20,     upgrade: 10 },
    { id: 'uncommon',     name: 'Uncommon',     tier: 1, color: '#4fe08e', glow: '#1fae60', glyph: '<path d="M12 3.5 20.5 12 12 20.5 3.5 12z"/>',                          essence: 16,   value: 60,     upgrade: 18 },
    { id: 'rare',         name: 'Rare',         tier: 2, color: '#4aa8ff', glow: '#1c78e0', glyph: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/>',                          essence: 34,   value: 180,    upgrade: 34 },
    { id: 'epic',         name: 'Epic',         tier: 3, color: '#b862ff', glow: '#8a2be2', glyph: '<path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>',                      essence: 80,   value: 600,    upgrade: 60 },
    { id: 'mythic',       name: 'Mythic',       tier: 4, color: '#ff4fa8', glow: '#e0147a', glyph: '<path d="M12 2l3.5 6 7-.5-3.5 6 3.5 6-7-.5L12 22l-3.5-6-7 .5 3.5-6-3.5-6 7 .5z"/>', essence: 190,  value: 2200,   upgrade: 110 },
    { id: 'legendary',    name: 'Legendary',    tier: 5, color: '#ffc247', glow: '#ff9a00', glyph: '<path d="M12 1l2.5 6.5L21 4l-3.5 6.5L23 12l-5.5 1.5L21 20l-6.5-3.5L12 23l-2.5-6.5L3 20l3.5-6.5L1 12l5.5-1.5L3 4l6.5 3.5z"/>', essence: 480,  value: 9000,   upgrade: 200 },
    { id: 'transcendent', name: 'Transcendent', tier: 6, color: '#6cf2ff', glow: '#00c8ff', glyph: '<path fill-rule="evenodd" d="M12 2l9 10-9 10L3 12zM12 7.5 16.5 12 12 16.5 7.5 12z"/>', essence: 1300, value: 40000,  upgrade: 380 },
    { id: 'anomaly',      name: 'Anomaly',      tier: 7, color: '#ff3b5c', glow: '#ff0044', glyph: '<path d="M3 3h8v5h5v5h5v8h-8v-5H8v-5H3z"/>',                          essence: 2800, value: 120000, upgrade: 700 },
  ];
  const RARITY = {}; RARITIES.forEach(r => (RARITY[r.id] = r));

  // ---------- Variants ----------
  const VARIANTS = [
    { id: 'none',        name: 'Standard',    mult: 1,   weight: 70,  note: '' },
    { id: 'foil',        name: 'Foil',        mult: 1.4, weight: 12,  note: 'A metallic sheen sweeps across the surface.' },
    { id: 'holographic', name: 'Holographic', mult: 1.8, weight: 7,   note: 'Light splits into a drifting rainbow film.' },
    { id: 'golden',      name: 'Golden',      mult: 2.2, weight: 3.5, note: 'Cast in warm, impossible gold.' },
    { id: 'inverted',    name: 'Inverted',    mult: 1.6, weight: 2.5, note: 'Its colors run the wrong way around.' },
    { id: 'shadow',      name: 'Shadow',      mult: 1.7, weight: 2.2, note: 'Soaked in violet dusk.' },
    { id: 'corrupted',   name: 'Corrupted',   mult: 2.0, weight: 1.2, note: 'Something is leaking through the edges.' },
    { id: 'celestial',   name: 'Celestial',   mult: 2.8, weight: 0.8, note: 'Wrapped in a small private night sky.' },
    { id: 'glitched',    name: 'Glitched',    mult: 3.0, weight: 0.5, note: 'It stutters between two versions of itself.' },
    { id: 'prismatic',   name: 'Prismatic',   mult: 4.0, weight: 0.3, note: 'Every color the Archive owns, at once.' },
  ];
  const VARIANT = {}; VARIANTS.forEach(v => (VARIANT[v.id] = v));

  // ---------- Conditions (tier 0 best → 4 worst) ----------
  const CONDITION_MULT = [1.5, 1.2, 1.0, 0.8, 0.6];
  const CONDITION_LABELS = {
    default:  ['Pristine', 'Fine', 'Worn', 'Weathered', 'Fractured'],
    pet:      ['Radiant', 'Thriving', 'Content', 'Weary', 'Fragile'],
    machine:  ['Factory New', 'Tuned', 'Used', 'Rusted', 'Wrecked'],
    relic:    ['Immaculate', 'Preserved', 'Aged', 'Eroded', 'Shattered'],
    oddity:   ['Stable', 'Flickering', 'Unstable', 'Warping', 'Collapsing'],
  };
  const CONDITION_WEIGHTS = [8, 30, 35, 20, 7];

  // ---------- Patterns / palettes / auras ----------
  const PATTERNS = [
    { id: 'plain',     name: 'Plain',      weight: 28 },
    { id: 'striped',   name: 'Tiger Stripe', weight: 12 },
    { id: 'spotted',   name: 'Spotted',    weight: 12 },
    { id: 'swirled',   name: 'Swirled',    weight: 10 },
    { id: 'starry',    name: 'Starry',     weight: 8 },
    { id: 'marbled',   name: 'Marbled',    weight: 10 },
    { id: 'checkered', name: 'Checkered',  weight: 8 },
    { id: 'scaled',    name: 'Scaled',     weight: 12 },
  ];
  const PALETTES = [
    { id: 0, name: 'Native',  hue: 0,   weight: 50 },
    { id: 1, name: 'Eclipse', hue: 60,  weight: 10 },
    { id: 2, name: 'Dawn',    hue: 115, weight: 10 },
    { id: 3, name: 'Tide',    hue: 170, weight: 10 },
    { id: 4, name: 'Ember',   hue: 235, weight: 10 },
    { id: 5, name: 'Bloom',   hue: 295, weight: 10 },
  ];
  const AURAS = [
    { id: 'none',      name: 'None',       color: null },
    { id: 'ember',     name: 'Ember Halo', color: '#ff8a3d' },
    { id: 'frost',     name: 'Frost Halo', color: '#8fe3ff' },
    { id: 'starlight', name: 'Starlight',  color: '#fff2a8' },
    { id: 'verdant',   name: 'Verdant',    color: '#6fe38a' },
    { id: 'void',      name: 'Void Veil',  color: '#a05cff' },
  ];

  const QUIRKS = {
    pet:     ['Hums when left idle', 'Chases its own shadow', 'Naps in impossible places', 'Collects tiny shiny things', 'Sneezes sparks', 'Follows the cursor with its eyes', 'Insists on being first', 'Leaves faint footprints of light'],
    gear:    ['Warm to the touch', 'Hums a single note', 'Never quite casts a shadow', 'Engraving shifts when unobserved', 'Rings softly when drawn', 'Smells faintly of rain'],
    relic:   ['Whispers in a dead language', 'Cold at midnight', 'Attracts small moths', 'Hums near other relics', 'Dust never settles on it', 'Slightly heavier than it looks'],
    machine: ['Idles with a purr', 'Blinks its lights in greeting', 'Leaves a trail of sparks', 'Rattles when excited', 'Refuses to start on Mondays', 'Plays a jingle on boot'],
    oddity:  ['Exists a little to the left', 'Is occasionally in two places', 'Hum is slightly flat', 'Smells like a color', 'Weighs different each time', 'Appears in old photographs'],
  };

  const PERSONALITIES = [
    { id: 'curious',    name: 'Curious',    lines: ['What does that button do?', 'Ooh — new things!', 'Can we look inside one more?'] },
    { id: 'sleepy',     name: 'Sleepy',     lines: ['Five more minutes…', 'Zzz… huh? Oh. Hello.', 'Is it nap o\'clock?'] },
    { id: 'bold',       name: 'Bold',       lines: ['Open the big one!', 'Fear nothing. Pull everything.', 'I was born ready.'] },
    { id: 'gentle',     name: 'Gentle',     lines: ['You\'re doing wonderfully.', 'Take your time, Collector.', 'Everything here is precious.'] },
    { id: 'mischievous',name: 'Mischievous',lines: ['I definitely didn\'t touch anything.', 'Dismantle it. Dismantle it.', 'Shall we cause a little luck?'] },
    { id: 'proud',      name: 'Proud',      lines: ['Admire me. Then the vault.', 'A fine collection, thanks to me.', 'Only the finest, Collector.'] },
    { id: 'shy',        name: 'Shy',        lines: ['Oh! You noticed me…', 'Um… hi.', 'I\'ll just stay right here.'] },
    { id: 'playful',    name: 'Playful',    lines: ['Catch me!', 'Again, again, again!', 'Boop!'] },
  ];

  // ---------- Items ----------
  // pal = [main, accent, dark, light]. Art function keyed by id lives in art.js
  const I = (id, name, cat, rarity, pal, lore, extra) => Object.assign({ id, name, cat, rarity, pal, lore, obtainable: true, evolves: [] }, extra || {});
  const ITEM_LIST = [
    // --- Pets ---
    I('nimbit', 'Nimbit', 'pet', 'common', ['#cfe6ff', '#7fb4ff', '#3a4f8a', '#ffffff'], 'A pocket-sized cloud that sulks when it\'s ignored. Static clings to its edges.',
      { stage: 'Hatchling', line: 'nimbus', evolves: [{ to: 'nimbus', level: 1, essence: 60, label: 'Gather' }] }),
    I('nimbus', 'Nimbus', 'pet', 'rare', ['#a9c3f2', '#5d86e0', '#2b3a78', '#e8f1ff'], 'It has learned to rumble. Small lightning dances inside its belly.',
      { stage: 'Young', line: 'nimbus', obtainable: false, evolves: [{ to: 'tempestral', level: 2, essence: 180, label: 'Thunder Path' }, { to: 'pluvia', level: 2, essence: 180, label: 'Rain Path' }] }),
    I('tempestral', 'Tempestral', 'pet', 'epic', ['#5b4cc4', '#ffd84a', '#1d1648', '#c9bcff'], 'A storm that chose to be a creature. The horns are real lightning.',
      { stage: 'Mature · Thunder', line: 'nimbus', obtainable: false, evolves: [{ to: 'stormsovereign', level: 3, essence: 520, label: 'Ascend' }] }),
    I('pluvia', 'Pluvia', 'pet', 'epic', ['#4fd1c5', '#9ef3ff', '#14606a', '#e3fffd'], 'A rain spirit who sings in drizzle. Every droplet on it remembers a sky.',
      { stage: 'Mature · Rain', line: 'nimbus', obtainable: false }),
    I('stormsovereign', 'Storm Sovereign', 'pet', 'legendary', ['#2a1f6b', '#ffe066', '#0d0830', '#b9a6ff'], 'The ruler of weather in a hundred forgotten skies. Thunder bows first.',
      { stage: 'Ascended', line: 'nimbus', obtainable: false }),
    I('emberkit', 'Emberkit', 'pet', 'common', ['#ff9a4a', '#ffd27a', '#7a2d12', '#fff0cf'], 'A kit whose tail never quite stops smoldering. Warm to hold. Hard to forget.',
      { stage: 'Hatchling', line: 'ember', evolves: [{ to: 'pyrodrake', level: 1, essence: 80, label: 'Kindle' }] }),
    I('pyrodrake', 'Pyrodrake', 'pet', 'rare', ['#e8452c', '#ffb347', '#561208', '#ffe3b0'], 'Wings unfolded from the embers. It exhales in tiny, polite bursts of flame.',
      { stage: 'Young', line: 'ember', obtainable: false }),
    I('pebblor', 'Pebblor', 'pet', 'uncommon', ['#9aa3b5', '#6fe3a0', '#3c4458', '#e8edf7'], 'Stacked from river-stones that wanted company. Moss grows where it blushes.'),
    I('mossback', 'Mossback', 'pet', 'uncommon', ['#6bb86a', '#f7a8d0', '#2f5a3a', '#d8f5c9'], 'A tortoise carrying a whole meadow. Butterflies queue to land on it.',
      { stage: 'Hatchling', line: 'grove', evolves: [{ to: 'grovewarden', level: 2, essence: 140, label: 'Take Root' }] }),
    I('grovewarden', 'Grovewarden', 'pet', 'epic', ['#4f8f56', '#ffd77a', '#1f3a2a', '#d8f5c9'], 'The meadow has become a grove, and the grove has become a guardian. Lantern-fruit ripens only for those it trusts.',
      { stage: 'Mature', line: 'grove', obtainable: false }),
    I('glimfin', 'Glimfin', 'pet', 'rare', ['#36d1c4', '#ffe28a', '#0f5a72', '#c6fbff'], 'Swims through the air as though it were water, trailing lantern bubbles.'),
    I('gloomwing', 'Gloomwing', 'pet', 'epic', ['#7a4fd1', '#ff7ad9', '#2a1450', '#e2cfff'], 'A moth that feeds on lamplight, then gives it back as dreams.'),
    I('voidling', 'Voidling', 'pet', 'mythic', ['#1a1233', '#c06bff', '#07040f', '#f1d9ff'], 'A hole shaped like a pet. Its many eyes never blink at the same time.'),
    I('sunmane', 'Sunmane', 'pet', 'legendary', ['#ffb42e', '#fff0a0', '#8a3a05', '#fffbe0'], 'Its mane is a small dawn. Where it sleeps, the room stays warm for years.'),
    // --- Gear ---
    I('rustblade', 'Rustblade', 'gear', 'common', ['#a0836a', '#d9b48c', '#4b3426', '#f0e0cf'], 'A sword that has seen better centuries. Still very much a sword.'),
    I('oakbuckler', 'Oak Buckler', 'gear', 'uncommon', ['#a8703c', '#c9ccd6', '#4a2c14', '#f2d4a8'], 'A round shield of ringwood, bound in iron. It remembers every dent.'),
    I('ionbow', 'Ionbow', 'gear', 'rare', ['#2a4a7a', '#4df0ff', '#0b1a33', '#bffaff'], 'Its string is a thread of captured current. The arrow arrives before the sound.'),
    I('gravehammer', 'Gravehammer', 'gear', 'epic', ['#6b5a85', '#b077ff', '#241a38', '#e6d4ff'], 'A bone-handled maul that only strikes things already forgotten.'),
    I('prismedge', 'Prismedge', 'gear', 'mythic', ['#9fd6ff', '#ff6fd8', '#3c4a8a', '#ffffff'], 'The blade splits light into seven rumors and sheds them as it swings.'),
    I('aegis', 'Starforged Aegis', 'gear', 'legendary', ['#2f6bd1', '#ffd36b', '#0d2255', '#cfe3ff'], 'Hammered from a falling star and polished by a thousand sunrises.'),
    // --- Relics ---
    I('bonecharm', 'Bone Charm', 'relic', 'common', ['#e9dcc4', '#8b6b4a', '#4a3a28', '#fff8ea'], 'A knucklebone on a cord. It brings luck to the one who didn\'t carve it.'),
    I('amberfossil', 'Amber Fossil', 'relic', 'uncommon', ['#ffb43a', '#6b3a10', '#4a2808', '#ffe6a8'], 'Something with too many wings, patient inside a drop of old sun.'),
    I('moonstone', 'Moonstone', 'relic', 'rare', ['#cfe0ff', '#8fa8ff', '#3b4a8a', '#ffffff'], 'A pale cabochon that waxes and wanes on its own schedule.'),
    I('oracletablet', 'Oracle Tablet', 'relic', 'epic', ['#7d8aa3', '#5af0c8', '#262f45', '#d6e0f5'], 'The runes rearrange when you aren\'t reading. The answer is always "soon".'),
    I('eclipsescepter', 'Eclipse Scepter', 'relic', 'mythic', ['#2b1d4a', '#ffbf3b', '#0e0720', '#ffe9a8'], 'A staff topped with a tiny, permanent eclipse. Shadows kneel nearby.'),
    I('sunkencrown', 'Sunken Crown', 'relic', 'legendary', ['#d9b24a', '#2fd6b4', '#4a3a10', '#fff0b8'], 'Drowned kings still argue over who wore it best. The pearls are warm.'),
    I('heartofeternity', 'Heart of Eternity', 'relic', 'transcendent', ['#7de8ff', '#ff8af0', '#2a2b8a', '#ffffff'], 'A crystal heart that beats once an age. The Archive was built around it.'),
    // --- Machines ---
    I('pocketdrone', 'Pocket Drone', 'machine', 'common', ['#c9d3e6', '#ff6a5a', '#3a4258', '#ffffff'], 'Folds into a coat pocket. Unfolds with opinions.'),
    I('scraprover', 'Scrap Rover', 'machine', 'uncommon', ['#c9863a', '#6ab4e8', '#4a2f12', '#ffe0a8'], 'Welded from six other machines\' bad days. Surprisingly steady.'),
    I('skyskiff', 'Sky Skiff', 'machine', 'rare', ['#e8c27a', '#ff5a7a', '#6a3a1e', '#fff3d0'], 'A river boat that was promised the sky and took the offer.'),
    I('chronoracer', 'Chrono Racer', 'machine', 'epic', ['#d32f5a', '#4df0ff', '#4a0f22', '#ffd0dc'], 'Arrives a little before it leaves. Gets stopped a lot, just to be sure.'),
    I('leviathan', 'Leviathan Engine', 'machine', 'mythic', ['#b87a3a', '#4dffb8', '#3a2410', '#ffe6c0'], 'The gears are large enough to hold weather. It has never fully stopped.'),
    I('starhopper', 'Starhopper', 'machine', 'legendary', ['#e8eef8', '#ff5a3a', '#44506a', '#ffffff'], 'A ship that jumps from star to star like stepping stones in a pond.'),
    // --- Oddities ---
    I('infinitesock', 'Infinite Sock', 'oddity', 'common', ['#ff7ac8', '#ffffff', '#7a1f5c', '#ffe0f4'], 'No matter how many you pull from the drawer, one is always missing.'),
    I('vendingfragment', 'Vending Fragment', 'oddity', 'uncommon', ['#8aa0b8', '#ff4f6a', '#2a3444', '#e0f0ff'], 'A panel from a machine that was never installed. The buttons still click.'),
    I('glitchedcursor', 'Glitched Cursor', 'oddity', 'rare', ['#f0f0ff', '#00f0ff', '#14142a', '#ff2bd6'], 'A pointer from a screen that doesn\'t exist. It points at things behind you.'),
    I('whisperjar', 'Whisper Jar', 'oddity', 'epic', ['#a9d0d8', '#c9a6ff', '#2a3f48', '#f0ffff'], 'Corked tight. Do not listen at night. Do not listen during the day, either.'),
    I('impossiblecube', 'Impossible Cube', 'oddity', 'mythic', ['#6fa8ff', '#ff7ad1', '#1a2a5a', '#e0f0ff'], 'Count its corners twice and get different answers. Both are right.'),
    I('backwardsclock', 'Backwards Clock', 'oddity', 'legendary', ['#e8c76a', '#7affd7', '#4a3510', '#fff6d6'], 'Tells you what time it was, with great confidence and little help.'),
    I('missingtexture', 'Missing Texture', 'oddity', 'anomaly', ['#ff00ff', '#000000', '#220022', '#ffffff'], 'The Archive forgot to draw this one. It remembers being forgotten.'),
  ];
  const ITEMS = {}; ITEM_LIST.forEach(i => (ITEMS[i.id] = i));

  const CATEGORIES = [
    { id: 'pet',     name: 'Pets',     single: 'Pet',     icon: 'paw',  color: '#ff9ad1' },
    { id: 'gear',    name: 'Gear',     single: 'Gear',    icon: 'sword',color: '#7fc8ff' },
    { id: 'relic',   name: 'Relics',   single: 'Relic',   icon: 'gem',  color: '#ffd36b' },
    { id: 'machine', name: 'Machines', single: 'Machine', icon: 'cog',  color: '#8affc4' },
    { id: 'oddity',  name: 'Oddities', single: 'Oddity',  icon: 'eye',  color: '#c9a2ff' },
  ];
  const CATEGORY = {}; CATEGORIES.forEach(c => (CATEGORY[c.id] = c));

  const UPGRADE_STAGES = ['Base', 'Enhanced', 'Ascended', 'Transcendent', 'Signature'];

  // ---------- Evolution lines (for the Atlas UI) ----------
  const EVO_LINES = [
    { id: 'nimbus', name: 'The Nimbus Line', blurb: 'Weather that learned to love.', root: 'nimbit' },
    { id: 'ember',  name: 'The Ember Line',  blurb: 'A spark that decided to stay.', root: 'emberkit' },
    { id: 'grove',  name: 'The Grove Line',  blurb: 'A meadow that learned to walk.', root: 'mossback' },
  ];

  // ---------- Containers ----------
  const STD_ODDS = { common: 54, uncommon: 26, rare: 12, epic: 5, mythic: 1.8, legendary: 0.7, transcendent: 0.12, anomaly: 0.04 };
  const CONTAINERS = [
    { id: 'wanderer', name: 'Wanderer Pack', kind: 'Pack', ritual: 'pack', desc: 'A foil-sealed pack of five Archive cards: printed creatures, places, relics, records and phenomena. Cards only; the last card is Uncommon or better.',
      price: { cur: 'credits', amt: 120 }, cats: ['card'], count: 5, slots: [{}, {}, {}, {}, { min: 'uncommon' }], ascending: true,
      odds: STD_ODDS, pity: { rarity: 'legendary', after: 60 }, variantBoost: 1, theme: ['#4aa8ff', '#7a5cff'], event: null, window: null },
    { id: 'hatchling', name: 'Hatchling Egg', kind: 'Egg', ritual: 'egg', desc: 'A warm, humming egg. Something small, ordinary and alive is dreaming inside: young pets of the common families.',
      price: { cur: 'credits', amt: 250 }, cats: ['pet'], items: ['nimbit', 'emberkit', 'pebblor', 'mossback', 'glimfin'], count: 1, slots: [{}],
      odds: { common: 58, uncommon: 30, rare: 12 }, pity: { rarity: 'rare', after: 12 }, variantBoost: 1, theme: ['#ff9ad1', '#ffd36b'], event: null, window: null },
    { id: 'capsule', name: 'Oddity Capsule', kind: 'Capsule', ritual: 'capsule', desc: 'A rattling sphere of questionable origin. Contains the uncontainable.',
      price: { cur: 'credits', amt: 90 }, cats: ['oddity'], count: 1, slots: [{}],
      odds: { common: 48, uncommon: 28, rare: 14, epic: 6, mythic: 2.2, legendary: 0.9, transcendent: 0, anomaly: 0.25 }, pity: { rarity: 'legendary', after: 40 }, variantBoost: 1.3, theme: ['#c9a2ff', '#4dffe0'], event: null, window: null },
    { id: 'forge', name: 'Forge Crate', kind: 'Crate', ritual: 'crate', desc: 'Riveted and sealed. Weapons and machines, with a guaranteed Rare or better.',
      price: { cur: 'keys', amt: 2 }, cats: ['gear', 'machine'], count: 2, slots: [{}, { min: 'rare' }],
      odds: STD_ODDS, pity: { rarity: 'legendary', after: 35 }, variantBoost: 1.2, theme: ['#ff8a3d', '#ffd36b'], event: null, window: null },
    { id: 'starlit', name: 'Starlit Egg', kind: 'Egg', ritual: 'starlit', desc: 'An egg lit from inside by a captured constellation. Prestigious, sky-born and celestial pets only, always Rare or better and of high potential.',
      price: { cur: 'gems', amt: 40 }, cats: ['pet'], items: ['nimbus', 'tempestral', 'pluvia', 'gloomwing', 'voidling', 'sunmane'], count: 1, slots: [{ min: 'rare' }], minPotential: 55,
      odds: { common: 0, uncommon: 0, rare: 62, epic: 26, mythic: 8, legendary: 3.6, transcendent: 0, anomaly: 0 }, pity: { rarity: 'legendary', after: 25 }, variantBoost: 2, theme: ['#6cf2ff', '#b862ff'], event: null, window: null },
    { id: 'reliquary', name: 'Relic Chest', kind: 'Chest', ritual: 'chest', desc: 'Sealed in wax and bronze. Relics and ceremonial objects only; the second prize is Epic or better.',
      price: { cur: 'gems', amt: 75 }, cats: ['relic'], count: 2, slots: [{ min: 'rare' }, { min: 'epic' }],
      odds: STD_ODDS, pity: { rarity: 'legendary', after: 25 }, variantBoost: 1.8, theme: ['#ffc247', '#2fd6b4'], event: null, window: null },
    { id: 'vault', name: 'Mythic Vault', kind: 'Vault', ritual: 'vault', desc: 'Triple-locked. A premium selection from every collectible division except Cards. Three prizes, rising in stature.',
      price: { cur: 'gems', amt: 200 }, cats: ['pet', 'gear', 'relic', 'machine', 'oddity'], count: 3, slots: [{ min: 'rare' }, { min: 'epic' }, { min: 'mythic' }],
      odds: { common: 0, uncommon: 0, rare: 40, epic: 34, mythic: 16, legendary: 7, transcendent: 2.2, anomaly: 0.8 }, pity: { rarity: 'legendary', after: 12 }, variantBoost: 3, theme: ['#ff4fa8', '#ffc247'], event: null, window: null },
  ];
  const CONTAINER = {}; CONTAINERS.forEach(c => (CONTAINER[c.id] = c));
  // Free onboarding gift
  const STARTER_EGG = { id: 'starter', name: 'First Egg', kind: 'Egg', ritual: 'egg', theme: ['#ffd36b', '#ff9ad1'], count: 1 };

  // ---------- Currencies ----------
  const CURRENCIES = [
    { id: 'credits', name: 'Credits', color: '#ffd36b', icon: 'coin' },
    { id: 'gems',    name: 'Gems',    color: '#6cf2ff', icon: 'gemcur' },
    { id: 'essence', name: 'Essence', color: '#d58aff', icon: 'essence' },
    { id: 'keys',    name: 'Keys',    color: '#ffa86b', icon: 'key' },
  ];
  const CURRENCY = {}; CURRENCIES.forEach(c => (CURRENCY[c.id] = c));

  // ---------- Store (all fictional) ----------
  const STORE = {
    cash: [
      { id: 'g1', gems: 80,   bonus: 0,    price: 0.99,  tag: '' },
      { id: 'g2', gems: 450,  bonus: 50,   price: 4.99,  tag: '' },
      { id: 'g3', gems: 1000, bonus: 150,  price: 9.99,  tag: 'Popular' },
      { id: 'g4', gems: 2200, bonus: 400,  price: 19.99, tag: '' },
      { id: 'g5', gems: 6000, bonus: 1500, price: 49.99, tag: 'Best Value' },
    ],
    exchange: [
      { id: 'x1', pay: { gems: 10 },  get: { credits: 500 } },
      { id: 'x2', pay: { gems: 50 },  get: { credits: 3000 } },
      { id: 'x3', pay: { gems: 15 },  get: { keys: 1 } },
      { id: 'x4', pay: { gems: 40 },  get: { keys: 3 } },
      { id: 'x5', pay: { gems: 10 },  get: { essence: 120 } },
      { id: 'x6', pay: { gems: 40 },  get: { essence: 600 } },
      { id: 'x7', pay: { essence: 100 }, get: { credits: 300 } },
    ],
    bundles: [
      { id: 'b1', name: 'Starter Satchel',    desc: 'A modest haul for a new Collector.', pay: { gems: 60 },  get: { credits: 2500, keys: 3, essence: 300 }, color: '#4aa8ff' },
      { id: 'b2', name: "Hatcher's Hoard",    desc: 'Credits and Essence for egg enthusiasts.', pay: { gems: 120 }, get: { credits: 6000, essence: 900 }, color: '#ff9ad1' },
      { id: 'b3', name: "Collector's Coffer", desc: 'A weighty chest of everything.', pay: { gems: 300 }, get: { credits: 16000, keys: 10, essence: 3000 }, color: '#ffc247' },
    ],
    dailyOffers: [
      { id: 'd1', name: 'Key Flurry',      desc: 'Seven keys, shaved price.', pay: { gems: 70 },  get: { keys: 7 }, color: '#ffa86b' },
      { id: 'd2', name: 'Essence Surge',   desc: 'A flood of upgrade fuel.',  pay: { gems: 45 },  get: { essence: 1000 }, color: '#d58aff' },
      { id: 'd3', name: 'Credit Cascade',  desc: 'A river of gold.',          pay: { gems: 35 },  get: { credits: 4500 }, color: '#ffd36b' },
      { id: 'd4', name: 'Archivist\'s Gift', desc: 'A little of everything.', pay: { gems: 50 },  get: { credits: 2000, keys: 2, essence: 400 }, color: '#6cf2ff' },
    ],
  };

  const DAILY_REWARDS = [
    { credits: 200 }, { credits: 250 }, { credits: 300, essence: 40 }, { credits: 350 },
    { credits: 400, keys: 1 }, { credits: 500, essence: 80 }, { credits: 800, gems: 15, keys: 2 },
  ];

  const TITLES = ['Initiate', 'Seeker', 'Curator', 'Archivist', 'Vaultkeeper', 'Warden', 'Luminary', 'Sovereign'];

  const NEWS = [
    'The Archive reports a record surge in Hatchling activity.',
    'Reminder: Dismantling releases Essence. Favorited and locked items are always safe.',
    'Collector sightings: a Voidling was seen blinking in unison. Investigations continue.',
    'Mythic Vault locks have been oiled. Please stand back.',
    'The Missing Texture has been missing again. Nobody is surprised.',
    'Storm weather in the Nimbus Line is expected to evolve.',
  ];

  AV.data = { RARITIES, RARITY, VARIANTS, VARIANT, CONDITION_MULT, CONDITION_LABELS, CONDITION_WEIGHTS, PATTERNS, PALETTES, AURAS, QUIRKS, PERSONALITIES,
    ITEM_LIST, ITEMS, CATEGORIES, CATEGORY, UPGRADE_STAGES, EVO_LINES, CONTAINERS, CONTAINER, STARTER_EGG, CURRENCIES, CURRENCY, STORE, DAILY_REWARDS, TITLES, NEWS };
})();
