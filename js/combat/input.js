/* AETHERVAULT — Combat input: one pointer/keyboard abstraction for the battle screen (mouse now, touch later through the same pointer events).
 * It knows nothing about game rules. It turns raw events into four intents and calls back:
 *   hover(cell|null)    the pointer is over the board (cell = { x, z } in arena cells) while something is being placed
 *   confirm(cell)       place / commit  (click on the board, or release a drag over the board)
 *   cancel()            abandon the current selection  (Esc, right-click, or releasing a drag off the board)
 *   key(name)           'slot1'…'slot4' · 'reshuffle' · 'pause'
 * Drag: pointerdown on a hand card calls beginDrag(); the drag then behaves like a held selection until release. */
(function () {
  const AV = (window.AV = window.AV || {}); AV.combat = AV.combat || {};

  class BattleInput {
    constructor(o) {
      this.canvas = o.canvas; this.pick = o.pick; this.cb = o.callbacks || {}; this.active = false; this.drag = null; this.last = null; this.off = [];
      const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); this.off.push(() => el.removeEventListener(ev, fn, opt)); };
      on(this.canvas, 'pointermove', e => this.move(e));
      on(this.canvas, 'pointerleave', () => { if (!this.drag) this.setHover(null); });
      on(this.canvas, 'pointerdown', e => { if (e.button === 0 && this.active) this.cb.confirm && this.cb.confirm(this.cellAt(e)); else if (e.button === 2) this.cb.cancel && this.cb.cancel(); });
      on(this.canvas, 'contextmenu', e => { e.preventDefault(); this.cb.cancel && this.cb.cancel(); });
      on(window, 'pointermove', e => { if (this.drag) this.dragMove(e); });
      on(window, 'pointerup', e => { if (this.drag) this.dragEnd(e); });
      on(window, 'pointercancel', () => { if (this.drag) { this.drag = null; this.cb.cancel && this.cb.cancel(); } });
      on(document, 'keydown', e => {
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        const k = e.key; let name = null;
        if (k >= '1' && k <= '4') name = 'slot' + k; else if (k === 'r' || k === 'R') name = 'reshuffle'; else if (k === 'p' || k === 'P') name = 'pause'; else if (k === 'Escape') { if (this.cb.cancel && this.cb.cancel() === true) { e.preventDefault(); return; } name = 'pause'; }
        if (name && this.cb.key) { e.preventDefault(); this.cb.key(name); }
      });
    }
    /** Something is being placed: pointer moves are reported and a click commits. */
    setActive(on) { this.active = !!on; if (!on) this.setHover(null); this.canvas.style.cursor = on ? 'crosshair' : ''; }
    cellAt(e) { const p = this.pick(e.clientX, e.clientY); return p ? { x: p.x, z: p.z } : null; }
    setHover(c) { const a = this.last, same = (!a && !c) || (a && c && Math.floor(a.x) === Math.floor(c.x) && Math.floor(a.z) === Math.floor(c.z)); this.last = c; if (!same && this.cb.hover) this.cb.hover(c); }
    move(e) { if (this.active) this.setHover(this.cellAt(e)); }
    /** Call from pointerdown on a hand card; the card is already selected by the caller. */
    beginDrag(e) { this.drag = { x0: e.clientX, y0: e.clientY, moved: false }; }
    dragMove(e) { const d = this.drag; if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 8) d.moved = true; if (d.moved) { const b = this.canvas.getBoundingClientRect(), inside = e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom; this.setHover(inside ? this.cellAt(e) : null); } }
    dragEnd(e) {
      const d = this.drag; this.drag = null; if (!d.moved) return; // a plain click on the card just keeps it selected
      const b = this.canvas.getBoundingClientRect(), inside = e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom;
      if (inside) this.cb.confirm && this.cb.confirm(this.cellAt(e)); else this.cb.cancel && this.cb.cancel();
    }
    dispose() { this.off.forEach(f => f()); this.off = []; }
  }
  AV.combat.input = { BattleInput };
})();
