/* AETHERVAULT — Phase Four card catalogue. Pure data + small pure helpers (no DOM). Loads after data.js, before progress.js.
 * Cards are their own collectible category ('card'): a printed object with a set, a number, a class, artwork, card rarity, a
 * material (fixed by rarity), and print traits rolled per copy (finish, foil treatment, edition, alternate art). A card may
 * DEPICT an existing specimen, but it is a separate collectible: pulling a card never grants the depicted specimen.
 * Adding a card: one row in SETS[n].cards. Artwork comes from the depicted item's art or a scene in cardart.js. */
(function () {
  const AV = (window.AV = window.AV || {});
  const D = AV.data;

  // ------------------------------------------------------------------ sets
  // symbol ids are drawn by cardart.js (original glyphs: eight-point star, keyhole, bound lock)
  const SETS = [
    { id: 'fla', code: 'FLA', name: 'First Light Archive', symbol: 'star', year: 'Accession Year I', blurb: 'The founding printing: the first creatures, rooms and records the Archive agreed to keep.', color: '#d7b46e' },
    { id: 'lsx', code: 'LSX', name: 'Lower Stacks Curiosa', symbol: 'key', year: 'Accession Year II', blurb: 'Oddities, phenomena and paperwork recovered from the shelves nobody admits to visiting.', color: '#9f8cff' },
    { id: 'dvl', code: 'DVL', name: 'Deep Vault Ledger', symbol: 'lock', year: 'Accession Year III', blurb: 'The sealed wing, printed at last: legendary beings and the Archive\'s heaviest treasures.', color: '#6cd8c8' },
  ];
  const SET = {}; SETS.forEach(s => (SET[s.id] = s));

  // ------------------------------------------------------------------ classes (what a card depicts)
  // pal = [main, accent, dark, light] used for the item's UI colour and the card's frame; arch = stat focus/weak (see stats.js 'card' family)
  const CLASSES = {
    creature:   { name: 'Creature',             pal: ['#5aa88a', '#e8d27a', '#1d3a33', '#e6f5ec'], arch: [['projection', 'depth'], 'preservation'] },
    being:      { name: 'Legendary Being',      pal: ['#2c2f6b', '#f0c867', '#0c0d26', '#e8e2ff'], arch: [['projection', 'prestige'], 'print'] },
    location:   { name: 'Archive Location',     pal: ['#a07a4a', '#f2d49a', '#3a2614', '#f6ead2'], arch: [['depth', 'print'], 'projection'] },
    relic:      { name: 'Relic',                pal: ['#7a2f45', '#f0c060', '#2a0e18', '#f6dfe6'], arch: [['preservation', 'prestige'], 'foil'] },
    machine:    { name: 'Machine',              pal: ['#4f6c8f', '#ffb15a', '#18222f', '#e2ecf7'], arch: [['print', 'projection'], 'depth'] },
    discovery:  { name: 'Historical Discovery', pal: ['#8a6a44', '#9fe0d0', '#2e2214', '#f1e6d2'], arch: [['preservation', 'depth'], 'projection'] },
    oddity:     { name: 'Oddity',               pal: ['#6a4fb0', '#5ff0e0', '#1a1236', '#efe6ff'], arch: [['foil', 'projection'], 'print'] },
    phenomenon: { name: 'Phenomenon',           pal: ['#2f5d9a', '#9ff5ff', '#0c1830', '#e0f2ff'], arch: [['foil', 'depth'], 'preservation'] },
    record:     { name: 'Curator Record',       pal: ['#b8a888', '#8a2a2a', '#3a3226', '#fbf5e6'], arch: [['print', 'preservation'], 'foil'] },
  };

  // fictional internal illustrators and imprints only
  const IMPRINTS = ['Wren Halloway', 'Odile Marsh', 'Tamsin Vey', 'Corvin Ashgrove', 'Ines Calloway', 'Bram Ostrander', 'Juniper Kade', 'Sister Ottoline', 'Pell Iverson', 'Hollis & Reed', 'The Lamplight Bindery', 'Archive Press No. 4'];

  // [no, class, rarity, subject, name, archive text]   subject: 'item:<id>' · 'scene:<kind>:<variant>' · 'being:<shape>' · 'null'
  const C = (no, cls, rarity, subject, name, text) => ({ no, cls, rarity, subject, name, text });
  SETS[0].cards = [
    C(1, 'creature', 'common', 'item:nimbit', 'Nimbit, Pocket Cloud', 'Sulks in a teacup until somebody notices the weather. Catalogued, sulking, on the first page.'),
    C(2, 'creature', 'common', 'item:emberkit', 'Emberkit by the Grate', 'Found curled in the reading-room grate. The grate has not been cold since.'),
    C(3, 'creature', 'uncommon', 'item:pebblor', 'Pebblor, Stacked', 'Four river stones that agreed to be one creature. They still argue about which one is the head.'),
    C(4, 'creature', 'uncommon', 'item:mossback', 'Mossback Crossing', 'Every spring the meadow on its back crosses the east gallery. Visitors wait. The butterflies insist.'),
    C(5, 'creature', 'rare', 'item:glimfin', 'Glimfin Shoal', 'A shoal of one, swimming through the reference section as though the air had always been water.'),
    C(6, 'discovery', 'common', 'item:rustblade', 'Rustblade, Recovered', 'Drawn from the Ninth Stair with its scabbard still arguing. Catalogue entry: still very much a sword.'),
    C(7, 'relic', 'common', 'item:bonecharm', 'Knucklebone Charm', 'Lucky for whoever did not carve it. The carver has asked, in writing, that this be noted.'),
    C(8, 'relic', 'uncommon', 'item:amberfossil', 'Amber, Patient', 'Something with too many wings waits inside a drop of old sun. It has been very good about waiting.'),
    C(9, 'machine', 'common', 'item:pocketdrone', 'Pocket Drone, Folded', 'Folds into a coat pocket and files complaints from inside it.'),
    C(10, 'machine', 'uncommon', 'item:scraprover', 'Scrap Rover on Patrol', 'Welded from six bad days. It patrols the loading dock and has never once lost a crate.'),
    C(11, 'location', 'common', 'scene:location:reading', 'The Reading Room', 'Seventy lamps, one rule: whisper. The books keep the rule better than the readers.'),
    C(12, 'location', 'common', 'scene:location:corridor', 'Lantern Corridor', 'Every arch has a lantern and every lantern has a name. The names are longer than the corridor.'),
    C(13, 'location', 'uncommon', 'scene:location:stair', 'The Ninth Stair', 'There are eight stairs. Curators who find the ninth are asked to bring something back.'),
    C(14, 'record', 'common', 'scene:record:ledger', 'Accession Ledger, Vol. I', 'Entry one: "A cloud, small, sulking." Entry two: "A second cloud. Sulking about the first."'),
    C(15, 'record', 'common', 'scene:record:note', 'A Curator\'s First Note', 'Pinned above the first desk: KEEP EVERYTHING. Below it, smaller: within reason. Below that: no.'),
    C(16, 'phenomenon', 'common', 'scene:phenomenon:motes', 'Dust in Slow Light', 'At four in the afternoon the dust stops falling and starts to read over your shoulder.'),
    C(17, 'phenomenon', 'uncommon', 'scene:phenomenon:inkrain', 'Ink Rain over the Stacks', 'Light, steady, faintly legible. Umbrellas are issued at the desk; reading them is discouraged.'),
    C(18, 'discovery', 'common', 'item:oakbuckler', 'Ringwood Buckler', 'Every dent is dated in the margin. The oldest predates the Archive by a respectful century.'),
    C(19, 'discovery', 'rare', 'item:ionbow', 'Ionbow, Strung', 'The string is a thread of captured current. The catalogue photograph arrived before the flash.'),
    C(20, 'relic', 'rare', 'item:moonstone', 'Moonstone Waning', 'Printed during the waning week. On full-moon nights the ink on this card is said to brighten.'),
    C(21, 'machine', 'rare', 'item:skyskiff', 'Sky Skiff at Mooring', 'Tied to the observatory rail by a single knot it pretends it cannot undo.'),
    C(22, 'location', 'rare', 'scene:location:observatory', 'The Observatory Gallery', 'A dome of brass and patience. The telescope points inward on Tuesdays, for inventory.'),
    C(23, 'discovery', 'rare', 'scene:discovery:orrery', 'The Brass Orrery', 'Models eleven worlds, two of which have not been found. It keeps their places warm.'),
    C(24, 'creature', 'epic', 'item:gloomwing', 'Gloomwing in Lamplight', 'It drinks the reading lamps at closing and pays them back as dreams, with interest.'),
    C(25, 'relic', 'epic', 'item:oracletablet', 'Oracle Tablet, Unread', 'The runes rearranged themselves for this printing. The answer, as ever, is "soon".'),
    C(26, 'phenomenon', 'epic', 'scene:phenomenon:aurora', 'Aurora Under the Roof', 'Once a year the Archive\'s weather forgets it is indoors. Staff are encouraged to look up.'),
    C(27, 'creature', 'epic', 'item:pyrodrake', 'Pyrodrake\'s First Flight', 'One loop of the atrium, three polite bursts of flame, and a landing nobody has stopped describing.'),
    C(28, 'being', 'mythic', 'being:stag', 'The Starbranch Stag', 'Its antlers are a map of the night the Archive was founded. Every point is a star that has since moved.'),
    C(29, 'being', 'legendary', 'item:stormsovereign', 'Storm Sovereign Enthroned', 'Thunder bows first. The card stock was chosen because it was the only paper that would not flinch.'),
    C(30, 'phenomenon', 'mythic', 'scene:phenomenon:dawn', 'First Light', 'The first morning the Archive kept. Every lamp in the building is lit from this one, eventually.'),
  ];
  SETS[1].cards = [
    C(1, 'oddity', 'common', 'item:infinitesock', 'The Infinite Sock', 'Filed under Pairs, Incomplete. The drawer it came from has been sealed and is still producing.'),
    C(2, 'oddity', 'common', 'item:vendingfragment', 'Vending Fragment, Lit', 'A panel from a machine that was never installed. Button B4 dispenses a feeling of having been here.'),
    C(3, 'oddity', 'uncommon', 'item:glitchedcursor', 'Glitched Cursor', 'It points at something behind whoever holds this card. Please do not turn around in the stacks.'),
    C(4, 'location', 'common', 'scene:location:gallery', 'The Drowned Gallery', 'Knee-deep, perfectly still, beautifully lit. The paintings prefer it. The visitors bring boots.'),
    C(5, 'phenomenon', 'common', 'scene:phenomenon:bell', 'The Bell for Empty Rooms', 'It rings only when nobody is there to hear it. The Archive keeps a bell-keeper anyway, out of respect.'),
    C(6, 'record', 'common', 'scene:record:census', 'Census of Things Under Beds', 'A complete count, taken quietly. Two entries were asked to sign; one did.'),
    C(7, 'discovery', 'uncommon', 'scene:discovery:mask', 'The Listening Mask', 'Worn by the second curator during inventory. It hears the shelves settle and translates, roughly.'),
    C(8, 'oddity', 'rare', 'item:whisperjar', 'Whisper Jar (Do Not Listen)', 'The cork is original. The whispers are new every printing. Do not hold this card to your ear.'),
    C(9, 'phenomenon', 'rare', 'scene:phenomenon:vortex', 'The Stairwell Vortex', 'Loose pages gather here and circle, very slowly, in alphabetical order.'),
    C(10, 'creature', 'rare', 'item:voidling', 'Voidling, Blinking', 'A hole shaped like a pet. Its eyes blink out of order, which the printers found very hard to register.'),
    C(11, 'machine', 'uncommon', 'item:chronoracer', 'Chrono Racer, Early', 'Photographed slightly before it arrived. The crowd in the background has not turned up yet.'),
    C(12, 'record', 'uncommon', 'scene:record:blueprint', 'Blueprint for a Door That Isn\'t', 'Approved, stamped and built. The door works perfectly; there is simply no wall for it to be in.'),
    C(13, 'oddity', 'epic', 'item:impossiblecube', 'Impossible Cube, Counted Twice', 'Eight corners on the front of the card. Nine on the back. The printers stopped counting.'),
    C(14, 'location', 'common', 'scene:location:garden', 'The Glasshouse Vivarium', 'Warm, green and slightly too large on the inside. The palms have opinions about the catalogue.'),
    C(15, 'discovery', 'uncommon', 'scene:discovery:compass', 'Compass Pointing Inward', 'Wherever you stand, it points at the middle of the Archive. Nobody has reached the middle yet.'),
    C(16, 'oddity', 'epic', 'item:backwardsclock', 'The Backwards Clock', 'Tells you what time it was, with great confidence. The card was printed tomorrow, it insists.'),
    C(17, 'being', 'mythic', 'being:moth', 'The Thousand-Key Moth', 'Every scale on its wings is a key to a door in the Lower Stacks. It sheds one each winter.'),
    C(18, 'phenomenon', 'rare', 'scene:phenomenon:tide', 'The Lantern Tide', 'Twice a night the lamps in the lower corridors drift to one end of the hall, and back.'),
    C(19, 'oddity', 'legendary', 'item:missingtexture', 'Missing Texture, Printed', 'The Archive forgot to draw it, so the printers did. It remembers being forgotten; it forgives them.'),
    C(20, 'oddity', 'anomaly', 'null', 'Misprint 404', 'This card was not printed. It is in your hand anyway. The Archive has filed it under Errors, Cherished.'),
  ];
  SETS[2].cards = [
    C(1, 'record', 'common', 'scene:record:seal', 'Decree of the Sealed Wing', 'By order of the first Curator: the Deep Vault is closed. By order of every Curator since: mostly.'),
    C(2, 'location', 'uncommon', 'scene:location:forge', 'The Transformation Chamber', 'Two pylons, one anvil, four lamps. Things come out of this room more themselves than they went in.'),
    C(3, 'discovery', 'rare', 'item:aegis', 'Starforged Aegis', 'Hammered from a falling star. The ledger records the star\'s formal objection, overruled.'),
    C(4, 'discovery', 'uncommon', 'item:gravehammer', 'Gravehammer, Catalogued', 'It only strikes things already forgotten, so it is kept in the one room nobody remembers.'),
    C(5, 'relic', 'epic', 'item:eclipsescepter', 'Eclipse Scepter', 'A tiny permanent eclipse at the head of a staff. Shadows in the print room knelt for the proofs.'),
    C(6, 'relic', 'epic', 'item:sunkencrown', 'Sunken Crown, Raised', 'Lifted from the drowned court with its pearls still warm. The court has requested it back, politely.'),
    C(7, 'machine', 'mythic', 'item:leviathan', 'The Leviathan Engine', 'The gears are large enough to hold weather. The card is smaller, and holds the sound of it.'),
    C(8, 'discovery', 'common', 'scene:discovery:fossil', 'Spiral of the First Shelf', 'A fossil coiled into the oldest shelf of the Archive. The shelf was built around it, carefully.'),
    C(9, 'being', 'mythic', 'being:whale', 'The Lantern Whale', 'It swims the high dark above the vault ceilings, carrying lanterns nobody lit, for readers nobody sees.'),
    C(10, 'being', 'mythic', 'being:serpent', 'The Index Serpent', 'Every scale an index entry, alphabetical from head to tail. It is still growing; so is the Archive.'),
    C(11, 'creature', 'legendary', 'item:sunmane', 'Sunmane at Daybreak', 'Its mane is a small dawn. The room this card was printed in has stayed warm for years.'),
    C(12, 'being', 'legendary', 'being:keeper', 'Archivist Prime', 'The first keeper of the Archive, or the shape the Archive remembers them by. It is still on duty.'),
    C(13, 'relic', 'transcendent', 'item:heartofeternity', 'Heart of Eternity', 'The Archive was built around it. This card was printed between two of its beats, which took a decade.'),
    C(14, 'location', 'transcendent', 'scene:location:vault', 'The Infinite Vault', 'The last room. It is larger than the card, the Archive and the night sky, and it fits in your hand.'),
  ];

  // ------------------------------------------------------------------ material hierarchy (fixed by card rarity tier)
  const MATERIALS = [
    { id: 'matte',   name: 'Matte Archive Stock',    note: 'Uncoated stock with visible fibres and a restrained border.' },
    { id: 'coated',  name: 'Coated Stock, Spot Gloss', note: 'Coated stock; the title plate and seal are spot-glossed.' },
    { id: 'foil',    name: 'Foilboard',              note: 'A metallic foil border and selected foil details.' },
    { id: 'holo',    name: 'Holographic Laminate',   note: 'A holographic layer that shifts with the viewing angle over a depth-separated illustration.' },
    { id: 'prism',   name: 'Layered Prism Film',     note: 'Parallax artwork under a two-layer prism foil, with a dyed premium edge.' },
    { id: 'leaf',    name: 'Borderless Leaf Print',  note: 'Borderless extended art under reactive layered foil; gilt edges.' },
    { id: 'lumen',   name: 'Lumen Glass',            note: 'An impossible stock: the illustration is a window deeper than the card is thick.' },
    { id: 'null',    name: 'Null Stock',             note: 'Stock that is not quite there. Parts of the print are somewhere else.' },
  ];
  const FINISHES = [
    { id: 'matte', name: 'Matte', w: [50, 30, 18, 10, 6, 4, 2, 2], fx: { print: 2, preservation: 2 } },
    { id: 'satin', name: 'Satin', w: [26, 34, 30, 24, 18, 14, 10, 10], fx: { depth: 2, print: 1 } },
    { id: 'gloss', name: 'Gloss', w: [18, 26, 30, 34, 34, 30, 28, 28], fx: { foil: 2, projection: 1 } },
    { id: 'linen', name: 'Linen Weave', w: [6, 8, 14, 18, 20, 22, 20, 20], fx: { preservation: 3 } },
    { id: 'etched', name: 'Etched', w: [0, 2, 8, 14, 22, 30, 40, 40], fx: { depth: 3, prestige: 1 } },
  ];
  // foil treatments allowed per material tier (index = tier); weights in the same order
  const FOILS = {
    none:      { name: 'No foil', cx: 0 },
    spot:      { name: 'Spot gloss', cx: 1 },
    border:    { name: 'Border foil', cx: 2 },
    artfoil:   { name: 'Art foil', cx: 3 },
    reverse:   { name: 'Reverse holo', cx: 4 },
    holo:      { name: 'Full holo', cx: 5 },
    prism:     { name: 'Prism weave', cx: 6 },
    starfield: { name: 'Starfield foil', cx: 7 },
    aurora:    { name: 'Aurora leaf', cx: 8 },
    nullfoil:  { name: 'Null foil', cx: 8 },
  };
  const FOIL_BY_TIER = [
    [['none', 92], ['spot', 8]],
    [['spot', 70], ['none', 20], ['border', 10]],
    [['border', 60], ['artfoil', 32], ['reverse', 8]],
    [['holo', 52], ['reverse', 34], ['artfoil', 14]],
    [['prism', 58], ['holo', 30], ['starfield', 12]],
    [['aurora', 55], ['prism', 30], ['starfield', 15]],
    [['starfield', 60], ['aurora', 40]],
    [['nullfoil', 100]],
  ];
  const EDITIONS = [
    { id: 'unlimited', name: 'Unlimited Edition', short: '', w: 82, prestige: 0 },
    { id: 'first', name: 'First Archive Edition', short: '1st', w: 12, prestige: 6 },
    { id: 'stamped', name: 'Accession Stamped', short: 'ACC', w: 5, prestige: 4 },
    { id: 'proof', name: 'Curator Proof', short: 'PROOF', w: 1, prestige: 10 },
  ];
  const EDITION = {}; EDITIONS.forEach(e => (EDITION[e.id] = e));
  const CONDITIONS = ['Gem Mint', 'Near Mint', 'Excellent', 'Played', 'Damaged'];
  const ALT_CHANCE = 0.07;

  // ------------------------------------------------------------------ register cards as items of the 'card' category
  const LIST = [];
  SETS.forEach(set => set.cards.forEach(c => {
    const id = 'c' + set.id + String(c.no).padStart(3, '0'), cls = CLASSES[c.cls];
    const meta = { set: set.id, no: c.no, of: set.cards.length, cls: c.cls, subject: c.subject, imprint: IMPRINTS[(c.no * 7 + set.id.charCodeAt(0)) % IMPRINTS.length] };
    const item = { id, name: c.name, cat: 'card', rarity: c.rarity, pal: cls.pal.slice(), lore: c.text, obtainable: true, evolves: [], card: meta };
    LIST.push(item); D.ITEMS[id] = item; D.ITEM_LIST.push(item);
  }));
  D.CATEGORIES.push({ id: 'card', name: 'Cards', single: 'Card', icon: 'card', color: '#e8d6a8' }); D.CATEGORY.card = D.CATEGORIES[D.CATEGORIES.length - 1];
  D.CONDITION_LABELS.card = CONDITIONS;
  D.QUIRKS.card = ['Smells faintly of archive ink', 'Printed a hair off-centre', 'The foil shifts before you tilt it', 'Back stamp is upside down', 'A tiny ink star in the lower margin', 'Slightly warm at the edges', 'The corner was never quite square', 'Hums near other cards of its set'];

  // ------------------------------------------------------------------ helpers
  const pickW = (rows, r) => { let t = 0; rows.forEach(x => (t += x[1])); let v = r() * t; for (const x of rows) { v -= x[1]; if (v < 0) return x[0]; } return rows[rows.length - 1][0]; };
  const isCard = itemOrId => { const it = typeof itemOrId === 'string' ? D.ITEMS[itemOrId] : itemOrId; return !!(it && it.cat === 'card'); };
  const tierOf = item => D.RARITY[item.rarity].tier;
  const material = item => MATERIALS[tierOf(item)];
  /** Rolls a copy's print traits. Deterministic for a given rng. opts may force any of them (Creator hook, tests). */
  function roll(item, r, opts = {}) {
    const t = tierOf(item);
    return {
      finish: opts.finish || pickW(FINISHES.map(f => [f.id, f.w[t]]), r),
      foil: opts.foil || pickW(FOIL_BY_TIER[t], r),
      edition: opts.edition || pickW(EDITIONS.map(e => [e.id, e.w * (e.id === 'proof' ? 1 + t * .5 : 1)]), r),
      alt: opts.alt != null ? (opts.alt ? 1 : 0) : (r() < ALT_CHANCE ? 1 : 0),
    };
  }
  /** Stat contribution of a copy's print traits (added to the trait part of each card stat in stats.js). */
  function bonus(spec, k) {
    const c = spec.card; if (!c) return 0; let b = 0;
    const f = FINISHES.find(x => x.id === c.finish); if (f && f.fx[k]) b += f.fx[k];
    const fo = FOILS[c.foil]; if (fo && k === 'foil') b += fo.cx * 1.2;
    const e = EDITION[c.edition]; if (e && k === 'prestige') b += e.prestige;
    if (c.alt && (k === 'depth' || k === 'prestige')) b += 3;
    return b;
  }
  const number = item => { const m = item.card, s = SET[m.set]; return `${s.code} ${String(m.no).padStart(3, '0')}/${String(m.of).padStart(3, '0')}`; };
  const describe = spec => { const it = D.ITEMS[spec.base], c = spec.card || {}; return { set: SET[it.card.set], number: number(it), cls: CLASSES[it.card.cls], material: material(it), finish: (FINISHES.find(f => f.id === c.finish) || FINISHES[0]).name, foil: (FOILS[c.foil] || FOILS.none).name, edition: (EDITION[c.edition] || EDITIONS[0]).name, alt: !!c.alt, imprint: it.card.imprint, subject: it.card.subject }; };
  /** A card spec's print key (thumbnail cache, binder grouping). */
  const key = c => (c ? [c.finish, c.foil, c.edition, c.alt ? 1 : 0].join('.') : '');
  const unkey = s => { if (!s) return null; const a = s.split('.'); return { finish: a[0], foil: a[1], edition: a[2], alt: +a[3] || 0 }; };
  /** The specimen a card depicts (never granted; used for artwork and holograms). */
  const depicted = item => { const s = item.card && item.card.subject; return s && s.startsWith('item:') ? s.slice(5) : null; };

  AV.cards = { SETS, SET, CLASSES, MATERIALS, FINISHES, FOILS, FOIL_BY_TIER, EDITIONS, EDITION, CONDITIONS, IMPRINTS, LIST, isCard, material, roll, bonus, number, describe, key, unkey, depicted, tierOf };
})();
