/* AETHERVAULT — Phase Three progression data. Pure data + small pure helpers (no DOM, no state).
 *   archetypes   which stat family an item uses, and its identity (focus / weak stats)
 *   stage names  category-specific names for the five upgrade stages, and what each stage visibly adds
 *   forms        every collectible's major transformation: a single final form or two branches
 *   looks        which appearances a specimen may display (current, earlier stages, earlier bases, unlocked forms)
 * Add an item: one ARCH row + one or two FORMS rows. */
(function () {
  const AV = (window.AV = window.AV || {});
  const D = AV.data;
  const FORM_LEVEL = 3; // stage index (0-based) at which a major transformation becomes available

  // ------------------------------------------------------------------ archetypes
  // fam: stat family (see stats.js) · focus: [primary, secondary] · weak: the item's soft spot
  const A = (fam, focus, weak) => ({ fam, focus, weak });
  const ARCH = {
    nimbit: A('pet', ['agility', 'instinct'], 'resilience'),        nimbus: A('pet', ['power', 'agility'], 'bond'),
    tempestral: A('pet', ['power', 'mutation'], 'bond'),            pluvia: A('pet', ['bond', 'resilience'], 'power'),
    stormsovereign: A('pet', ['power', 'instinct'], 'bond'),        emberkit: A('pet', ['agility', 'power'], 'resilience'),
    pyrodrake: A('pet', ['power', 'agility'], 'bond'),              pebblor: A('pet', ['resilience', 'bond'], 'agility'),
    mossback: A('pet', ['resilience', 'bond'], 'agility'),          grovewarden: A('pet', ['resilience', 'instinct'], 'agility'),
    glimfin: A('pet', ['agility', 'instinct'], 'power'),            gloomwing: A('pet', ['mutation', 'instinct'], 'resilience'),
    voidling: A('pet', ['mutation', 'instinct'], 'bond'),           sunmane: A('pet', ['power', 'bond'], 'mutation'),
    rustblade: A('weapon', ['stability', 'power'], 'energy'),       ionbow: A('weapon', ['precision', 'energy'], 'stability'),
    gravehammer: A('weapon', ['power', 'crit'], 'speed'),           prismedge: A('weapon', ['speed', 'crit'], 'stability'),
    oakbuckler: A('shield', ['resilience', 'guard'], 'energy'),     aegis: A('shield', ['guard', 'reflect'], 'stability'),
    bonecharm: A('relic', ['preservation', 'potency'], 'resonance'), amberfossil: A('relic', ['preservation', 'mystery'], 'potency'),
    moonstone: A('relic', ['resonance', 'stability'], 'potency'),   oracletablet: A('relic', ['mystery', 'resonance'], 'stability'),
    eclipsescepter: A('relic', ['potency', 'mystery'], 'preservation'), sunkencrown: A('relic', ['resonance', 'preservation'], 'stability'),
    heartofeternity: A('relic', ['resonance', 'preservation'], 'mystery'),
    pocketdrone: A('machine', ['efficiency', 'precision'], 'durability'), scraprover: A('machine', ['durability', 'stability'], 'precision'),
    skyskiff: A('machine', ['efficiency', 'output'], 'durability'), chronoracer: A('machine', ['overdrive', 'precision'], 'stability'),
    leviathan: A('machine', ['output', 'durability'], 'efficiency'), starhopper: A('machine', ['output', 'overdrive'], 'stability'),
    infinitesock: A('oddity', ['activity', 'containment'], 'coherence'), vendingfragment: A('oddity', ['coherence', 'activity'], 'distortion'),
    glitchedcursor: A('oddity', ['distortion', 'activity'], 'stability'), whisperjar: A('oddity', ['containment', 'distortion'], 'activity'),
    impossiblecube: A('oddity', ['coherence', 'distortion'], 'containment'), backwardsclock: A('oddity', ['coherence', 'stability'], 'activity'),
    missingtexture: A('oddity', ['distortion', 'activity'], 'coherence'),
  };

  // ------------------------------------------------------------------ stage names (display category → names)
  const STAGE_NAMES = {
    weapon:  ['Forged', 'Tempered', 'Awakened', 'Exalted', 'Signature'],
    shield:  ['Forged', 'Tempered', 'Awakened', 'Exalted', 'Signature'],
    pet:     ['Young', 'Mature', 'Ascended', 'Mythic', 'Apex Form'],
    machine: ['Standard', 'Tuned', 'Overclocked', 'Prototype', 'Apex Configuration'],
    relic:   ['Dormant', 'Restored', 'Resonant', 'Awakened', 'True Form'],
    oddity:  ['Contained', 'Active', 'Unstable', 'Manifested', 'Breached'],
  };
  // What each stage visibly adds (structural parts built by stage3d/forms.js, in addition to the model's own details)
  const STAGE_UNLOCKS = {
    weapon:  ['', 'Engraved trim bands', 'Mounted blade fins', 'Floating guard shards', 'Signature mantle plate'],
    shield:  ['', 'Engraved trim bands', 'Mounted side fins', 'Floating guard shards', 'Signature mantle plate'],
    pet:     ['', 'A collar charm', 'A back crest', 'Tufted horn-fins', 'Apex mantle and plumes'],
    machine: ['', 'Reinforcing braces', 'Exhaust stacks', 'Prototype frame struts', 'Apex gear crown'],
    relic:   ['', 'Restored brass mounts', 'A resonant glyph slate', 'Orbiting fragments', 'A crown of light motes'],
    oddity:  ['', 'Containment brackets', 'Flicker echoes', 'Unstable tear shards', 'A manifest rift'],
  };
  const displayCat = itemId => { const a = ARCH[itemId]; return a ? (a.fam) : 'weapon'; };
  const stageNames = itemId => STAGE_NAMES[displayCat(itemId)];
  const stageName = (itemId, level) => stageNames(itemId)[Math.max(0, Math.min(4, level | 0))];
  const stageUnlock = (itemId, level) => STAGE_UNLOCKS[displayCat(itemId)][Math.max(0, Math.min(4, level | 0))];

  // ------------------------------------------------------------------ forms (major transformations)
  // [item, id, name, kind, lean{stat:+n}, trade{stat:-n}|null, motifs[], tint, archive blurb, behaviour]
  // A branch is two rows with the same item. Motifs are implemented in stage3d/forms.js ('elem:flame|water|bolt|light|dust').
  const ROWS = [
    // ---- pets
    ['pluvia', 'monsoonchoir', 'Monsoon Choir', 'Mutation', { power: 10, agility: 6 }, { resilience: 3 }, ['spines', 'elem:water'], '#3fb6ff', 'The drizzle became a downpour with opinions. Its song now arrives as weather.', 'Restless; circles the room in small squalls.'],
    ['pluvia', 'stillwater', 'Stillwater Oracle', 'Apex form', { resilience: 10, bond: 8, instinct: 4 }, null, ['halo', 'crystals'], '#9ef3ff', 'Every droplet went quiet and clear. It reflects questions back as answers.', 'Calm; watches you with unhurried patience.'],
    ['stormsovereign', 'stormcrowned', 'Stormcrowned Eternal', 'Apex form', { power: 10, instinct: 8, mutation: 4 }, null, ['crown', 'wings', 'elem:bolt'], '#ffe066', 'A crown of standing lightning and wings made of weather fronts.', 'Regal; thunder answers when it lifts its head.'],
    ['pyrodrake', 'cinderlord', 'Cinderlord', 'Mutation', { power: 12, agility: 4 }, { resilience: 3 }, ['spines', 'elem:flame'], '#ff5a2c', 'Spined and smouldering. The polite bursts of flame are no longer polite.', 'Aggressive; hunts every flicker of light in the room.'],
    ['pyrodrake', 'hearthwarden', 'Hearthwarden', 'Apex form', { resilience: 10, bond: 8 }, null, ['plates', 'halo'], '#ffb347', 'Banked coals under armour plates. It keeps one small, steady fire for you.', 'Protective; settles beside you and does not move.'],
    ['pebblor', 'cairnkeeper', 'Cairnkeeper', 'Apex form', { resilience: 12, bond: 6 }, null, ['plates', 'roots'], '#8fb39a', 'A tall stack of patient stones, rooted and unbothered. Travellers leave offerings.', 'Stoic; refuses to be moved on weekdays.'],
    ['pebblor', 'geodeheart', 'Geode Heart', 'Mutation', { mutation: 12, instinct: 6 }, { bond: 2 }, ['crystals', 'orbit'], '#b886ff', 'Cracked open from inside. Violet crystal grew where the moss was.', 'Curious; hums at passing minerals.'],
    ['grovewarden', 'elder', 'Elder Canopy', 'Apex form', { resilience: 8, bond: 8, instinct: 6 }, null, ['roots', 'crown', 'elem:dust'], '#7fe38a', 'A whole canopy on one back. Lantern-fruit and drifting seed-light.', 'Gentle; birds file formal requests to land.'],
    ['glimfin', 'abyssal', 'Abyssal Lantern', 'Mutation', { instinct: 10, mutation: 8 }, null, ['eyes', 'elem:water'], '#36e0ff', 'It has been somewhere very deep and brought back more eyes than it left with.', 'Watchful; lights its lantern for you alone.'],
    ['glimfin', 'tidestrider', 'Tide Strider', 'Apex form', { agility: 12, power: 4 }, null, ['wings', 'elem:water'], '#7fe6d8', 'Fins like sails, wake like a comet. It swims faster than the air can be told about.', 'Playful; races its own reflection.'],
    ['gloomwing', 'lampweaver', 'Lampweaver', 'Apex form', { bond: 10, instinct: 8 }, null, ['wings', 'orbit'], '#ffb8f0', 'It weaves lamplight into thread and hangs it for the dreamers.', 'Tender; tucks sleepers in with spare light.'],
    ['gloomwing', 'nightbloom', 'Nightbloom', 'Mutation', { mutation: 12, power: 6 }, { bond: 2 }, ['tendrils', 'crystals'], '#b06bff', 'Petals of dusk unfurl along the wings. The dreams it gives back are sharper now.', 'Secretive; only opens at night.'],
    ['voidling', 'eventide', 'Eventide Maw', 'Mutation', { power: 12, mutation: 8 }, { bond: 3 }, ['tendrils', 'rift'], '#c06bff', 'The hole learned to open wider. Things fall in; it politely says thank you.', 'Hungry; stares at the light fixtures.'],
    ['voidling', 'sentinel', 'Many-Eyed Sentinel', 'Apex form', { instinct: 12, resilience: 6 }, null, ['eyes', 'cage'], '#e0b0ff', 'Every eye keeps a different watch. Nothing crosses the room unseen.', 'Vigilant; blinks in shifts.'],
    ['sunmane', 'daybreak', 'Daybreak Sovereign', 'Apex form', { power: 8, bond: 10, resilience: 6 }, null, ['crown', 'halo', 'elem:light'], '#ffe27a', 'The small dawn finished rising. The mane is a morning and a promise.', 'Warm; the room feels earlier when it enters.'],
    // ---- weapons and shields
    ['rustblade', 'quickened', 'Quickened Edge', 'Reforging', { speed: 12, precision: 6 }, { stability: 3 }, ['blades', 'echo'], '#ffd2a0', 'Pared to a thread of old steel. It moves before the thought of moving.', 'Quick; hums when drawn.'],
    ['rustblade', 'cleaver', 'Heavy Cleaver', 'Reforging', { power: 14, crit: 5 }, { speed: 4 }, ['plates', 'spines'], '#c88a5a', 'Every century of rust became weight. It does not swing; it arrives.', 'Heavy; the floor remembers it.'],
    ['oakbuckler', 'bastion', 'Ringwood Bastion', 'Reforging', { guard: 12, resilience: 8 }, null, ['plates', 'roots'], '#b9884f', 'More ring than wood now: bands of iron grown into the grain.', 'Steadfast; takes the blow and thanks it.'],
    ['oakbuckler', 'thornwall', 'Thornwall', 'Awakening', { reflect: 12, guard: 4 }, null, ['spines', 'roots'], '#7fb86a', 'The oak remembered it was alive. Thorns grew where the dents were.', 'Spiteful; returns what it is given.'],
    ['ionbow', 'stormstring', 'Stormstring', 'Awakening', { speed: 12, crit: 6 }, null, ['blades', 'elem:bolt'], '#7fe8ff', 'The string is a standing arc. Arrows leave as lightning.', 'Eager; crackles when the string is touched.'],
    ['ionbow', 'railbow', 'Railbow', 'Reforging', { precision: 14, power: 6 }, { speed: 3 }, ['gears', 'halo'], '#bfe0ff', 'Rails, sight and a patient capacitor. It does not miss on principle.', 'Exacting; a single clean tone before each shot.'],
    ['gravehammer', 'sepulcher', 'Sepulcher Maul', 'Awakening', { power: 12, crit: 8, energy: 4 }, null, ['spines', 'rift'], '#b077ff', 'It no longer waits for forgotten things. It makes them.', 'Grave; the air goes thin around the head.'],
    ['prismedge', 'rumours', 'Seven Rumours', 'Awakening', { speed: 12, energy: 6 }, null, ['blades', 'orbit'], '#ff8ae0', 'Seven slivers of light travel with the blade and tell tales as they fly.', 'Gossipy; each swing sheds a new story.'],
    ['prismedge', 'refraction', 'Refraction Blade', 'Reforging', { crit: 14, precision: 6 }, null, ['crystals', 'halo'], '#9fe0ff', 'One facet, perfectly aimed. All the light in the room arrives at the tip.', 'Focused; bends the room towards its point.'],
    ['aegis', 'starfall', 'Starfall Bulwark', 'Awakening', { guard: 10, reflect: 8, energy: 8 }, null, ['crown', 'orbit', 'halo'], '#ffe07a', 'The falling star finished falling. What is left is a wall of small suns.', 'Resolute; the constellations rearrange behind it.'],
    // ---- relics
    ['bonecharm', 'totem', 'Luck-Carved Totem', 'Restoration', { potency: 10, preservation: 8 }, null, ['orbit', 'halo'], '#ffe9b0', 'Rewound and re-carved by a gentler hand. The luck is now on purpose.', 'Warm; clacks softly when fortune turns.'],
    ['bonecharm', 'hexknuckle', 'Hex Knuckle', 'Unsealing', { mystery: 12, potency: 6 }, { preservation: 4 }, ['tendrils', 'elem:dust'], '#9a6bff', 'Someone carved the other side of the luck. It is considerably less polite.', 'Sly; the cord tightens when you hesitate.'],
    ['amberfossil', 'chrysalis', 'Awakened Chrysalis', 'Awakening', { resonance: 10, mystery: 8 }, null, ['wings', 'elem:light'], '#ffd060', 'The patient thing inside stirred. Light moves beneath the resin like breath.', 'Restless; its wings tremble against the glass.'],
    ['amberfossil', 'reliquary', 'Gilded Reliquary', 'Restoration', { preservation: 12, stability: 8 }, null, ['cage', 'crystals'], '#e0b050', 'Gold claws and a crystal cap. It will outlast everything it watches.', 'Solemn; remembers on your behalf.'],
    ['moonstone', 'fullmoon', 'Full Moon', 'Restoration', { resonance: 12, preservation: 6 }, null, ['halo', 'orbit'], '#e8f0ff', 'At last it keeps a full schedule: bright, round, entirely sure of itself.', 'Serene; the room goes pale and clear.'],
    ['moonstone', 'eclipsed', 'Eclipsed Moon', 'Unsealing', { mystery: 12, potency: 8 }, { stability: 3 }, ['rift', 'echo'], '#6a5cff', 'The other half of the cycle, kept for itself. A dark disc with a bright edge.', 'Withdrawn; shadows lean towards it.'],
    ['oracletablet', 'prophecy', 'Unsealed Prophecy', 'Unsealing', { mystery: 10, resonance: 10, potency: 4 }, null, ['orbit', 'halo', 'gears'], '#5af0c8', 'The runes finally agree on a single line. It reads: now.', 'Patient; answers before you ask.'],
    ['eclipsescepter', 'dawn', 'Dawn Scepter', 'Restoration', { resonance: 10, preservation: 8 }, null, ['crown', 'elem:light'], '#ffd26a', 'The eclipse ends at the edge of its own corona. Shadows rise instead of kneel.', 'Gracious; lifts shadows to their feet.'],
    ['eclipsescepter', 'totality', 'Totality Scepter', 'Unsealing', { potency: 12, mystery: 8 }, null, ['rift', 'tendrils'], '#8a5cff', 'Totality, kept. The disc is complete, and so is the dark around it.', 'Imperious; the lamp flames bow.'],
    ['sunkencrown', 'drowned', 'Crown of the Drowned Court', 'Restoration', { resonance: 8, preservation: 8, potency: 6 }, null, ['crown', 'roots', 'elem:water'], '#2fd6b4', 'The court has been called back from the deep. Every pearl is a seat.', 'Stately; water follows it around the room.'],
    ['heartofeternity', 'unsealed', 'Heart Unsealed', 'True form', { resonance: 10, potency: 8, preservation: 8, mystery: 4 }, null, ['halo', 'orbit', 'crystals'], '#9ff0ff', 'The Archive was built around it. Now it beats once, and the Archive hears.', 'Eternal; each beat takes an age to arrive.'],
    // ---- machines
    ['pocketdrone', 'surveyor', 'Surveyor Prime', 'Reconstruction', { efficiency: 10, precision: 10 }, null, ['orbit', 'gears'], '#a0d0ff', 'Rebuilt around a sensor ring. It maps the room before it enters.', 'Methodical; files observations unprompted.'],
    ['pocketdrone', 'courier', 'Overdrive Courier', 'Overclocking', { overdrive: 12, output: 6 }, { stability: 3 }, ['vents', 'wings'], '#ff7a5a', 'Over-tuned rotors and a delivery deadline. It arrives slightly before it leaves.', 'Impatient; taps the rotors at red lights.'],
    ['scraprover', 'hauler', 'Salvage Hauler', 'Reconstruction', { durability: 12, output: 6 }, null, ['plates', 'gears'], '#d9a05a', 'Six bad days, plated over and made useful. It carries what the others couldn\'t.', 'Dependable; shrugs off the weather.'],
    ['scraprover', 'rustwalker', 'Rustwalker Prototype', 'Prototype conversion', { overdrive: 10, output: 8 }, { stability: 4 }, ['vents', 'spines'], '#ff8a3d', 'A prototype nobody approved. It walks, and it is fast, and it rattles.', 'Reckless; takes the shortcut through the wall.'],
    ['skyskiff', 'galleon', 'Cloud Galleon', 'Reconstruction', { output: 8, efficiency: 8, stability: 8 }, null, ['wings', 'crown', 'elem:dust'], '#fff0c0', 'The river boat finally became the ship the sky wanted. Sails of cloud.', 'Proud; steers by weather.'],
    ['chronoracer', 'metronome', 'Metronome Racer', 'Reconstruction', { precision: 12, efficiency: 8 }, null, ['echo', 'gears'], '#4df0ff', 'It now arrives exactly when it left. The echoes tick in time.', 'Precise; every lap is the same lap.'],
    ['chronoracer', 'paradox', 'Paradox Racer', 'Prototype conversion', { overdrive: 14, output: 4 }, { stability: 4 }, ['echo', 'rift'], '#ff4f9a', 'It finishes the race before the start. Several of it are on the grid.', 'Giddy; crosses its own finish line.'],
    ['leviathan', 'tidal', 'Tidal Colossus', 'Reconstruction', { efficiency: 10, durability: 10 }, null, ['plates', 'elem:water'], '#4dffc8', 'Rebuilt to run on tide instead of fury. Slow, immense, and unstoppable.', 'Deep; pulses with the moon.'],
    ['leviathan', 'unbound', 'Unbound Colossus', 'Overclocking', { overdrive: 14, output: 8 }, { stability: 5 }, ['vents', 'tendrils'], '#ff6a3d', 'Every governor removed. It runs hot enough to light the Archive from below.', 'Furious; the floor feels it first.'],
    ['starhopper', 'constellation', 'Constellation Hopper', 'Prototype conversion', { output: 8, efficiency: 8, overdrive: 6 }, null, ['wings', 'orbit', 'vents'], '#ffd0a0', 'It no longer jumps between stars. It draws lines between them, and rides those.', 'Wanderlust; its map is always open.'],
    // ---- oddities
    ['infinitesock', 'boundless', 'Boundless Sock', 'Manifestation', { activity: 10, coherence: 6, distortion: 6 }, null, ['echo', 'rift'], '#ff9ae0', 'The drawer is now a doorway. Socks come through. One is always missing.', 'Unruly; fills the room with identical cuffs.'],
    ['vendingfragment', 'remembered', 'Remembered Dispenser', 'Containment', { containment: 12, coherence: 8 }, null, ['cage', 'gears'], '#9fc0e8', 'Held together by remembering what it was meant to sell. Mostly safe snacks.', 'Orderly; politely refuses your change.'],
    ['vendingfragment', 'breached', 'Breached Dispenser', 'Breach', { activity: 12, distortion: 8 }, { containment: 4 }, ['rift', 'tendrils'], '#ff4f6a', 'Something behind the panel is dispensing. It is not snacks.', 'Insistent; every button lights at once.'],
    ['glitchedcursor', 'sovereign', 'Pointer Sovereign', 'Activation', { coherence: 10, activity: 8 }, null, ['crown', 'echo'], '#00f0ff', 'It chose a target and stopped stuttering. The screen behind you agrees.', 'Decisive; points and is obeyed.'],
    ['glitchedcursor', 'swarm', 'Cursor Swarm', 'Manifestation', { distortion: 12, activity: 8 }, { coherence: 3 }, ['echo', 'orbit'], '#ff2bd6', 'There is no longer a cursor. There are forty of them, none agreeing.', 'Chaotic; everywhere at once.'],
    ['whisperjar', 'sealed', 'Sealed Murmur', 'Containment', { containment: 14, stability: 6 }, null, ['cage', 'halo'], '#c9a6ff', 'Triple-sealed in brass. The whisper is now a lullaby for the shelf.', 'Hushed; the cork stays down.'],
    ['whisperjar', 'choir', 'Unstoppered Choir', 'Manifestation', { activity: 12, distortion: 8 }, null, ['tendrils', 'elem:dust', 'rift'], '#e0c0ff', 'The cork is gone. A whole room of whispers, in harmony, not wanting to be heard.', 'Eerie; sings under the floorboards.'],
    ['impossiblecube', 'hyper', 'Folded Hypercube', 'Containment', { coherence: 12, stability: 8 }, null, ['cage', 'echo'], '#6fa8ff', 'Folded flat into a single legitimate answer. Eight corners, counted once.', 'Tidy; agrees with itself.'],
    ['impossiblecube', 'unfolded', 'Unfolded Cube', 'Manifestation', { distortion: 14, activity: 6 }, null, ['rift', 'orbit'], '#ff7ad1', 'Every face opened at once. Count the corners and lose count.', 'Evasive; is not where you looked.'],
    ['backwardsclock', 'thatwas', 'The Clock That Was', 'Manifestation', { coherence: 10, activity: 8, distortion: 6 }, null, ['echo', 'gears', 'halo'], '#7affd7', 'It remembers every hour it was right. They stand around it, a polite crowd.', 'Nostalgic; ticks towards yesterday.'],
    ['missingtexture', 'placeholder', 'Placeholder Reality', 'Breach', { distortion: 12, activity: 10 }, { coherence: 4 }, ['rift', 'echo'], '#ff00ff', 'The Archive stopped pretending. What it draws instead is a magenta plain.', 'Absent; is somewhere else being fine.'],
  ];
  const FORMS = {}, BY_ITEM = {};
  ROWS.forEach(r => {
    const f = { id: r[1], item: r[0], name: r[2], kind: r[3], lean: r[4], trade: r[5], motifs: r[6], tint: r[7], blurb: r[8], behave: r[9] };
    FORMS[f.id] = f; (BY_ITEM[f.item] = BY_ITEM[f.item] || []).push(f);
  });
  const formsFor = itemId => BY_ITEM[itemId] || [];
  const form = id => FORMS[id] || null;
  /** Items whose major transformation is an evolution (pets with D.ITEMS[x].evolves). */
  const hasEvolution = itemId => !!(D.ITEMS[itemId] && D.ITEMS[itemId].evolves && D.ITEMS[itemId].evolves.length);
  const isBranching = itemId => formsFor(itemId).length > 1 || (D.ITEMS[itemId] && D.ITEMS[itemId].evolves.length > 1);
  const kindOf = itemId => hasEvolution(itemId) ? 'evolution' : formsFor(itemId).length ? 'form' : 'none';

  /** Essence + Credits to take a major transformation. */
  function transformCost(itemId) {
    const R = D.RARITY[D.ITEMS[itemId].rarity], essence = Math.ceil(R.upgrade * 5);
    return { essence, credits: essence * 4 };
  }

  // ------------------------------------------------------------------ looks (which appearances a specimen can display)
  // ids: 'auto' · 'plain' (no form) · 'form:<id>' · 'base:<itemId>' (an earlier species) · 'lv:<n>' (an earlier stage)
  function looksOf(spec) {
    const out = [{ id: 'auto', name: 'Current', note: spec.form ? form(spec.form).name : stageName(spec.base, spec.level) }];
    for (let n = 0; n < spec.level; n++) out.push({ id: 'lv:' + n, name: stageName(spec.base, n), note: 'Earlier stage' });
    if (spec.form) out.push({ id: 'plain', name: 'Without ' + form(spec.form).name, note: 'Unformed' });
    (spec.looks || []).forEach(l => {
      if (l.startsWith('form:') && form(l.slice(5)) && l !== 'form:' + spec.form) out.push({ id: l, name: form(l.slice(5)).name, note: 'Former branch' });
      else if (l.startsWith('base:') && D.ITEMS[l.slice(5)]) out.push({ id: l, name: D.ITEMS[l.slice(5)].name, note: 'Earlier species' });
    });
    return out;
  }
  /** The render spec (base/level/form) a specimen shows given its look preference, with an optional override look. */
  function displaySpec(spec, lookId) {
    const look = lookId || spec.look || 'auto', o = Object.assign({}, spec);
    if (look === 'plain') o.form = null;
    else if (look.startsWith('lv:')) { o.level = Math.min(spec.level, +look.slice(3) || 0); o.form = null; }
    else if (look.startsWith('form:') && form(look.slice(5))) o.form = look.slice(5);
    else if (look.startsWith('base:') && D.ITEMS[look.slice(5)]) { o.base = look.slice(5); o.form = null; }
    return o;
  }

  AV.progress = { FORM_LEVEL, ARCH, STAGE_NAMES, STAGE_UNLOCKS, FORMS, formsFor, form, hasEvolution, isBranching, kindOf, transformCost,
    stageNames, stageName, stageUnlock, displayCat, looksOf, displaySpec };
})();
