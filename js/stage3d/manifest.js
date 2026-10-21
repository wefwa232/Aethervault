/* AETHERVAULT — model manifest (Tier C). Which script file defines which 3D model. Files listed here are NOT loaded up front:
 * AV.stage.ensure(key) fetches one on demand, and AV.stage.ensureAll() loads the rest one at a time after Home is on screen.
 * (Containers are first-screen content and stay eager in index.html.) A model file only registers builders — nothing is built
 * or compiled until a view or thumbnail actually asks for that model. */
(function () {
  const AV = window.AV; if (!AV || !AV.stage || AV.stage.failed) return;
  const S = AV.stage, P = 'js/stage3d/';
  const FILES = {
    'models-pets.js': ['nimbit', 'nimbus', 'tempestral', 'pluvia', 'stormsovereign'],
    'models-creatures.js': ['emberkit', 'pyrodrake', 'mossback', 'grovewarden'],
    'models-pets2.js': ['pebblor', 'glimfin', 'gloomwing', 'voidling', 'sunmane'],
    'models-sword.js': ['rustblade', 'prismedge'],
    'models-gear2.js': ['ionbow', 'gravehammer'],
    'models-gear3.js': ['oakbuckler', 'aegis'],
    'models-relic.js': ['heartofeternity'],
    'models-relic2.js': ['oracletablet', 'moonstone'],
    'models-relic3.js': ['bonecharm', 'amberfossil', 'eclipsescepter', 'sunkencrown'],
    'models-machine.js': ['leviathan'],
    'models-machine2.js': ['pocketdrone', 'scraprover'],
    'models-machine3.js': ['skyskiff', 'chronoracer', 'starhopper'],
    'models-oddity.js': ['whisperjar'],
    'models-oddity3.js': ['infinitesock', 'vendingfragment', 'glitchedcursor'],
    'models-oddity2.js': ['impossiblecube', 'missingtexture', 'backwardsclock'],
  };
  Object.keys(FILES).forEach(f => FILES[f].forEach(k => { S.lazy[k] = P + f; }));
})();
