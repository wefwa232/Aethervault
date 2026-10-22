/* AETHERVAULT — Combat input: one pointer/keyboard abstraction for the battle screen (mouse now, touch later through the same pointer events).
 * It knows nothing about game rules. It turns raw events into intents and calls back:
 *   hover(cell|null)        the pointer is over the board while a mode (placing a card, aiming, ordering) is active        cell = { x, z } in arena cells
 *   confirm(cell, e)        commit the active mode (left click on the board, or release of a drag over the board)
 *   cancel() → true|false   abandon the active mode; return true when something WAS cancelled (Esc then does not also pause)
 *   select(e, cell) → 'pet'|…  left click while no mode is active: select/deselect. Returning 'pet' lets the press become a drag-order
 *   order(e, cell)          right click while no mode is active: an order for the selected Pet (move on ground, priority on an enemy)
 *   dragOrder(e, cell)      a Pet was dragged and released somewhere on the board
 *   dragMove(e, cell)       while dragging a Pet (to draw the order line)
 *   key(name)               'slot1'…'slot4' · 'reshuffle' · 'pause' · 'q' 'e' 'r' · 'move' · 'target' · 'stop' · 'next' · 'confirm'
 * Every aim mode cancels three ways: Esc, right-click, and a visible Cancel button (owned by the screen). */
(function () {
  const AV = (window.AV = window.AV || {}); AV.combat = AV.combat || {};

  class BattleInput {
    constructor(o) {
      this.canvas = o.canvas; this.pick = o.pick; this.cb = o.callbacks || {}; this.active = false; this.drag = null; this.pdrag = null; this.last = null; this.off = [];
      const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); this.off.push(() => el.removeEventListener(ev, fn, opt)); };
      on(this.canvas, 'pointermove', e => this.move(e));
      on(this.canvas, 'pointerleave', () => { if (!this.drag && !this.pdrag) this.setHover(null); });
      on(this.canvas, 'pointerdown', e => {
        if (e.button === 0) {
          if (this.active) { this.cb.confirm && this.cb.confirm(this.cellAt(e), e); return; }
          const r = this.cb.select && this.cb.select(e, this.cellAt(e)); if (r === 'pet') this.pdrag = { x0: e.clientX, y0: e.clientY, moved: false };
        } else if (e.button === 2) {
          const used = this.cb.cancel && this.cb.cancel(); if (used !== true && this.cb.order) this.cb.order(e, this.cellAt(e));
        }
      });
      on(this.canvas, 'contextmenu', e => e.preventDefault());
      on(window, 'pointermove', e => { if (this.drag) this.dragMove(e); if (this.pdrag) this.petDragMove(e); });
      on(window, 'pointerup', e => { if (this.drag) this.dragEnd(e); if (this.pdrag) this.petDragEnd(e); });
      on(window, 'pointercancel', () => { if (this.drag) { this.drag = null; this.cb.cancel && this.cb.cancel(); } if (this.pdrag) { this.pdrag = null; this.cb.dragMove && this.cb.dragMove(null, null); } });
      on(document, 'keydown', e => {
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
        const k = e.key; let name = null;
        if (k >= '1' && k <= '4') name = 'slot' + k;
        else if (k === 'x' || k === 'X') name = 'reshuffle'; else if (k === 'p' || k === 'P') name = 'pause';
        else if (k === 'q' || k === 'Q') name = 'q'; else if (k === 'e' || k === 'E') name = 'e'; else if (k === 'r' || k === 'R') name = 'r';
        else if (k === 'm' || k === 'M') name = 'move'; else if (k === 't' || k === 'T') name = 'target'; else if (k === 's' || k === 'S') name = 'stop';
        else if (k === 'Tab') name = e.shiftKey ? 'prev' : 'next'; else if (k === 'Enter') name = 'confirm';
        else if (k === 'Escape') { if (this.cb.cancel && this.cb.cancel() === true) { e.preventDefault(); return; } name = 'escape'; }
        if (name && this.cb.key) { e.preventDefault(); this.cb.key(name); }
      });
    }
    /** A mode is active: pointer moves are reported and a click commits. */
    setActive(on) { this.active = !!on; if (!on) this.setHover(null); this.canvas.style.cursor = on ? 'crosshair' : ''; }
    cellAt(e) { const p = this.pick(e.clientX, e.clientY); return p ? { x: p.x, z: p.z } : null; }
    setHover(c) { const a = this.last, same = (!a && !c) || (a && c && Math.floor(a.x * 2) === Math.floor(c.x * 2) && Math.floor(a.z * 2) === Math.floor(c.z * 2)); this.last = c; if (!same && this.cb.hover) this.cb.hover(c); }
    move(e) { if (this.active) this.setHover(this.cellAt(e)); }
    inside(e) { const b = this.canvas.getBoundingClientRect(); return e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom; }
    /** Call from pointerdown on a hand card; the card is already selected by the caller. */
    beginDrag(e) { this.drag = { x0: e.clientX, y0: e.clientY, moved: false }; }
    dragMove(e) { const d = this.drag; if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 8) d.moved = true; if (d.moved) this.setHover(this.inside(e) ? this.cellAt(e) : null); }
    dragEnd(e) {
      const d = this.drag; this.drag = null; if (!d.moved) return; // a plain click on the card just keeps it selected
      if (this.inside(e)) this.cb.confirm && this.cb.confirm(this.cellAt(e), e); else this.cb.cancel && this.cb.cancel();
    }
    petDragMove(e) { const d = this.pdrag; if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 10) d.moved = true; if (d.moved && this.cb.dragMove) this.cb.dragMove(e, this.inside(e) ? this.cellAt(e) : null); }
    petDragEnd(e) {
      const d = this.pdrag; this.pdrag = null; if (this.cb.dragMove) this.cb.dragMove(null, null); if (!d.moved) return;
      if (this.inside(e) && this.cb.dragOrder) this.cb.dragOrder(e, this.cellAt(e));
    }
    dispose() { this.off.forEach(f => f()); this.off = []; }
  }
  AV.combat.input = { BattleInput };
})();
