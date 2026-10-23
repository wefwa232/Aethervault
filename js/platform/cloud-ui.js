/* AETHERVAULT — Settings → Account → Cloud saves panel and its dialogs (compare, resolve, backups, delete).
   Presentation only: every decision is explicit here, the engine (cloud.js) does the preserving and the writing. */
(function () {
  const AV = (window.AV = window.AV || {});
  const U = AV.util, esc = U.esc;
  const fmtN = n => Number(n || 0).toLocaleString();
  const when = t => { const d = new Date(t); return isNaN(d) ? '—' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); };
  const ago = t => { if (!t) return 'never'; const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 45 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : when(t); };
  const REASONS = { replaced: 'Replaced by another device', 'local-preserved': 'Device copy kept', 'cloud-preserved': 'Cloud copy kept', manual: 'Manual backup' };
  const toast = (m, kind) => AV.ui.toast(m, { kind: kind || 'info', icon: kind === 'bad' ? 'close' : 'info', silent: true });
  const guard = async fn => { try { await fn(); return true; } catch (e) { toast(e.message || 'That did not work. Your local progress is unchanged.', 'bad'); return false; } };

  function rows(local, head) {
    const L = (local && local.summary) || local || {}, H = head ? (head.summary || {}) : null;
    const line = (label, a, b) => `<tr><th scope="row">${label}</th><td>${a}</td>${H ? `<td>${b}</td>` : ''}</tr>`;
    return `<table class="cmp"><thead><tr><th></th><th>This device</th>${H ? '<th>Cloud</th>' : ''}</tr></thead><tbody>
      ${line('Collector', esc(L.name || '—') + (L.title ? ` <small>${esc(L.title)}</small>` : ''), H ? esc(H.name || '—') + (H.title ? ` <small>${esc(H.title)}</small>` : '') : '')}
      ${line('Specimens', fmtN(L.specimens), H ? fmtN(H.specimens) : '')}
      ${line('Level', fmtN(L.level), H ? fmtN(H.level) : '')}
      ${line('Credits', fmtN(L.credits), H ? fmtN(H.credits) : '')}
      ${line('Gems · Essence', fmtN(L.gems) + ' · ' + fmtN(L.essence), H ? fmtN(H.gems) + ' · ' + fmtN(H.essence) : '')}
      ${line('Combat wins / games', fmtN(L.wins) + ' / ' + fmtN(L.games), H ? fmtN(H.wins) + ' / ' + fmtN(H.games) : '')}
      ${H ? line('Last saved by', 'this device', esc(head.device_name || 'a device') + `<br><small>${esc(when(head.updated_at))}</small>`) : ''}
    </tbody></table>`;
  }

  /** Two-sided choice. Resolves 'device' | 'cloud' | null. */
  function decide({ title, intro, info, device, cloud }) {
    const buttons = [{ label: 'Not now', kind: 'ghost', value: null }];
    if (cloud) buttons.push({ label: 'Keep cloud version', kind: 'primary', value: 'cloud' });
    if (device) buttons.push({ label: 'Keep this device', kind: 'primary', value: 'device' });
    return AV.ui.modal({ title, wide: true, cls: 'cloud-decide', dismissValue: null,
      html: `<p class="confirm-msg">${intro}</p>${rows(info.local, info.head)}<p class="muted tiny">Whichever you don’t keep is saved first as a backup (a safety copy on this device and a cloud backup), so nothing is lost either way.</p>`, buttons }).promise;
  }

  function panelHtml() {
    const c = AV.cloud; if (!c) return '';
    const i = c.info(); if (!i.configured || !i.supported || !i.signedIn) return '';
    const body = [];
    if (!i.linked) {
      body.push('<p class="muted">Cloud saves are <b>off</b> on this device. Turn them on to keep this archive in your account and continue on another device. Your save always stays on this device first; nothing is uploaded, downloaded or replaced until you confirm what happens.</p>');
      body.push('<div class="btn-row"><button class="btn" data-act="cloud-on">Turn on cloud saves…</button></div>');
    } else {
      const s = i.status, msg = { idle: 'Up to date.', dirty: 'Changes are waiting to sync.', syncing: 'Syncing…' }[s] || esc(i.detail || '');
      const tone = s === 'idle' || s === 'dirty' || s === 'syncing' ? 'dim' : 'bad-txt';
      body.push(`<p class="muted">Cloud saves are <b>on</b>. ${i.device ? `This device: <b>${esc(i.device.name)}</b>.` : ''}</p>`);
      body.push(`<p class="${tone} tiny" role="status" id="cloudStatus" data-status="${esc(s)}">${msg}</p>`);
      body.push(`<p class="muted tiny" id="cloudLast">Last successful sync: ${esc(ago(i.lastSyncAt))}${i.revision ? ` · revision ${i.revision}` : ''}</p>`);
      const b = [];
      b.push(`<button class="btn" data-act="cloud-sync" ${s === 'syncing' ? 'disabled' : ''}>Sync now</button>`);
      if (s === 'conflict') b.push('<button class="btn" data-act="cloud-resolve">Resolve…</button>');
      if (s === 'cloud-newer') b.push('<button class="btn" data-act="cloud-load">Load cloud version…</button>');
      b.push('<button class="btn ghost" data-act="cloud-compare">Compare…</button><button class="btn ghost" data-act="cloud-backups">Cloud backups…</button>');
      b.push('<button class="btn ghost" data-act="cloud-off">Turn off on this device</button><button class="btn danger" data-act="cloud-delete">Delete cloud data…</button>');
      body.push(`<div class="btn-row">${b.join('')}</div>`);
    }
    return `<hr><h4 class="field-h">Cloud saves</h4>${body.join('')}`;
  }

  async function enable() {
    const c = AV.cloud, i = await c.inspect();
    if (i.kind === 'same' || i.kind === 'empty') { await c.linkSame(); toast('Cloud saves are on'); c.sync(); return; }
    if (i.kind === 'upload') {
      const ok = await AV.ui.confirm({ title: 'Upload this device’s progress?', confirmText: 'Upload and turn on', icon: 'upload',
        message: 'Your account has no cloud save yet. This uploads the archive on this device. Your local save is not changed.', extra: rows(i.local, null) });
      if (ok) { await c.keepDevice(); toast('Uploaded — cloud saves are on'); }
      return;
    }
    if (i.kind === 'download') {
      const ok = await AV.ui.confirm({ title: 'Load your cloud save?', confirmText: 'Load cloud save', icon: 'download',
        message: 'This device has no progress yet, and your account has a cloud save. Loading it replaces this empty archive (a safety copy is kept first).', extra: rows(i.local, i.head) });
      if (ok) { await c.keepCloud(); toast('Cloud save loaded'); }
      return;
    }
    const v = await decide({ title: 'This device and your account both have progress', info: i, device: true, cloud: true,
      intro: 'The archive on this device is different from the one in your account. Choose which one to keep. Nothing happens until you choose.' });
    if (v === 'device') { await c.keepDevice(); toast('This device’s save is now your cloud save'); }
    else if (v === 'cloud') { await c.keepCloud(); toast('Cloud save loaded on this device'); }
  }

  async function resolve() {
    const c = AV.cloud, p = c.pending; if (!p) return;
    const i = await c.inspect();
    if (p.kind === 'cloud-deleted') {
      const ok = await AV.ui.confirm({ title: 'The cloud save was deleted', confirmText: 'Upload this device’s save', icon: 'upload',
        message: 'The cloud copy was deleted from another device. This device still has your progress. Upload it again, or cancel and decide later (nothing is lost on this device).', extra: rows(i.local, null) });
      if (ok) { await c.keepDevice(); toast('Uploaded again'); }
      return;
    }
    const reset = p.kind === 'reset';
    const v = await decide({ title: reset ? 'This device was reset' : 'Two devices changed', info: i, device: true, cloud: true,
      intro: reset ? 'This device’s archive is empty, but your account still has progress. Restore the cloud copy, or keep the empty archive (which replaces the cloud copy).'
        : 'Both this device and another device changed the archive since they last synced. Choose which one to keep.' });
    if (v === 'device') { await c.keepDevice(); toast('This device’s save is now your cloud save'); }
    else if (v === 'cloud') { await c.keepCloud(); toast('Cloud save loaded on this device'); }
  }

  async function loadNewer() {
    const c = AV.cloud, i = await c.inspect();
    const ok = await AV.ui.confirm({ title: 'Load the newer cloud save?', confirmText: 'Load cloud save', icon: 'download',
      message: 'This replaces the archive on this device with the newer one from your account. A safety copy of this device’s archive is kept first.', extra: rows(i.local, i.head) });
    if (ok) { await c.keepCloud(); toast('Cloud save loaded'); }
  }

  async function compare() {
    const i = await AV.cloud.inspect();
    await AV.ui.modal({ title: i.head ? (i.kind === 'same' ? 'Compare — both are identical' : 'Compare') : 'Compare — nothing in the cloud yet', wide: true, cls: 'cloud-decide',
      html: rows(i.local, i.head), buttons: [{ label: 'Close', kind: 'ghost', value: null }] }).promise;
  }

  async function backups() {
    const c = AV.cloud, list = await c.listBackups();
    const html = list.length ? `<ul class="cloud-bk">${list.map(b => `<li><div><b>${esc(REASONS[b.reason] || b.reason)}</b> · ${esc(when(b.created_at))}<br><small>${esc(b.device_name || 'a device')} · ${fmtN((b.summary || {}).specimens)} specimens · level ${fmtN((b.summary || {}).level)} · ${fmtN((b.summary || {}).credits)} credits</small></div><button class="btn ghost" data-rb="${esc(b.id)}">Restore…</button></li>`).join('')}</ul>`
      : '<p class="muted">No cloud backups yet. A backup is made automatically before a different device’s save replaces yours, and before any choice that would replace a version.</p>';
    let pick = null;
    const m = AV.ui.modal({ title: 'Cloud backups', wide: true, cls: 'cloud-decide', html, buttons: [{ label: 'Close', kind: 'ghost', value: null }], dismissValue: null,
      onOpen(api) { api.el.addEventListener('click', e => { const b = e.target.closest('[data-rb]'); if (b) { pick = b.dataset.rb; api.close(pick); } }); } });
    const id = await m.promise; if (!id) return;
    const ok = await AV.ui.confirm({ title: 'Restore this backup?', confirmText: 'Restore backup', icon: 'download',
      message: 'This replaces the archive on this device with the backup, then makes it your cloud save. This device’s current archive and the current cloud save are preserved as backups first.' });
    if (ok) { await c.restoreBackup(id); toast('Backup restored'); }
  }

  async function del() {
    const t = await AV.ui.prompt({ title: 'Delete cloud data', label: 'This permanently deletes your cloud save and all cloud backups. Your save on this device is not touched. Type DELETE to confirm.', value: '', max: 10, okText: 'Delete cloud data' });
    if (t !== 'DELETE') { if (t != null) toast('Cancelled — text did not match'); return; }
    await AV.cloud.deleteCloud(); toast('Cloud data deleted. Your local save is untouched.');
  }

  /** Settings click handler. Returns true if the action was one of ours. */
  async function act(a) {
    const c = AV.cloud; if (!c) return false;
    const map = {
      'cloud-on': enable, 'cloud-resolve': resolve, 'cloud-load': loadNewer, 'cloud-compare': compare, 'cloud-backups': backups, 'cloud-delete': del,
      'cloud-sync': async () => { await c.sync(); const i = c.info(); if (i.status === 'idle') toast('Synced'); },
      'cloud-off': async () => { const ok = await AV.ui.confirm({ title: 'Turn off cloud saves here?', confirmText: 'Turn off', message: 'This device stops syncing. Your local save and your cloud data are not changed.' }); if (ok) { c.disable(); toast('Cloud saves are off on this device'); } },
    };
    if (!map[a]) return false;
    await guard(map[a]); return true;
  }

  AV.cloudUi = { panelHtml, act };
})();
