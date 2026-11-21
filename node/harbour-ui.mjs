// Mare Liberum · the harbour's desk — the small program the /harbour page runs in a person's browser
// A crew opens its harbour here, lays in sources, approves what was proposed, tries a question and copies the address
// its models connect to. The key stays in the memory of the page: it is not written to disk, not put into a cookie,
// and it is gone when the tab closes. Everything a harbour holds is put on the page as text, never as markup.
// (Plain script without template literals, so it can travel inside the page as it is.)
export const HARBOUR_UI = String.raw`(function () {
  var B = location.origin, key = '', role = '';
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs) {
    var e = document.createElement(tag), k, i; attrs = attrs || {};
    for (k in attrs) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'click') e.addEventListener('click', attrs[k]); else e.setAttribute(k, attrs[k]); }
    for (i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    return e;
  }
  function call(word, data, get) {
    var url = B + '/harbour/' + word, opt = { method: get ? 'GET' : 'POST', headers: { accept: 'application/json' } };
    if (key) opt.headers.authorization = 'Bearer ' + key;
    if (get) { if (data) url += '?' + new URLSearchParams(data); } else { opt.headers['content-type'] = 'application/json'; opt.body = JSON.stringify(data || {}); }
    return fetch(url, opt).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error((j.error && j.error.message) || ('error ' + r.status)); return j; }); });
  }
  function say(id, msg, bad) { var e = $(id); if (!e) return; e.textContent = msg || ''; e.style.color = bad ? '#ff9b6b' : '#9fd7ff'; }
  function fail(id) { return function (e) { say(id, e.message || 'that did not work', true); }; }
  function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); }
  function lines(v) { return String(v || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
  function copy(text, btn) { navigator.clipboard.writeText(text).then(function () { var t = btn.textContent; btn.textContent = 'copied'; setTimeout(function () { btn.textContent = t; }, 1200); }); }
  function row() { var d = el('div', { class: 'row' }), i; for (i = 0; i < arguments.length; i++) if (arguments[i]) d.appendChild(arguments[i]); return d; }
  function btn(text, fn) { return el('button', { type: 'button', text: text, click: fn }); }

  // ---- open a new harbour
  $('new').addEventListener('submit', function (ev) {
    ev.preventDefault(); say('newmsg', 'opening …');
    var f = ev.target;
    call('new', { name: f.name.value, purpose: f.purpose.value, rules: lines(f.rules.value), closed: f.closed.checked }).then(function (r) {
      say('newmsg', 'Your harbour is open. Keep the three keys now: they are shown once.');
      var box = $('keys'); clear(box); box.hidden = false;
      ['owner', 'crew', 'guest'].forEach(function (k) { var c = el('code', { text: r.keys[k] }); box.appendChild(row(el('b', { text: k + ' ' }), c, btn('copy', function (e) { copy(r.keys[k], e.target); }))); });
      box.appendChild(el('p', { class: 'muted', text: 'owner: everything. crew: read, propose sources, lay ways, keep notes. guest: read only. Hand the crew key to your models and colleagues; keep the owner key to yourself.' }));
      $('key').value = r.keys.owner; enter();
    }).catch(fail('newmsg'));
  });

  // ---- enter a harbour with a key
  function enter() {
    key = $('key').value.trim(); say('openmsg', 'opening …');
    call('about', null, true).then(function (r) {
      role = r.role; say('openmsg', '');
      $('desk').hidden = false; $('hname').textContent = r.harbour.name; $('hrole').textContent = 'your key: ' + r.role;
      $('holds').textContent = r.holds.sources + ' sources · ' + (r.holds.proposed || 0) + ' proposed · ' + r.holds.ways + ' ways · ' + r.holds.notes + ' notes · ' + r.holds.characters.toLocaleString('en-US') + ' of ' + r.holds.room.toLocaleString('en-US') + ' characters';
      $('instr').textContent = r.instructions;
      var f = $('frame'); f.purpose.value = (r.frame && r.frame.purpose) || ''; f.rules.value = ((r.frame && r.frame.rules) || []).join('\n'); f.closed.checked = !r.frame || r.frame.closed !== false;
      var own = role === 'owner'; f.hidden = !own; $('exp').hidden = !own;
      $('connect').textContent = 'MCP address:  ' + B + '/harbour/mcp\nHeader:       Authorization: Bearer ' + key + '\n\nFor apps that take only an address (Claude, ChatGPT):\n' + B + '/h/' + key + '/mcp\n\nPlain HTTPS:  GET ' + B + '/harbour/search?q=<question>  with the same header';
      sources(); ways(); notes();
    }).catch(fail('openmsg'));
  }
  $('open').addEventListener('submit', function (ev) { ev.preventDefault(); enter(); });

  // ---- sources
  function sources() {
    call('sources', null, true).then(function (r) {
      var box = $('srcs'); clear(box);
      if (!r.sources.length) box.appendChild(el('p', { class: 'muted', text: 'No sources yet. Lay in the first one below.' }));
      r.sources.forEach(function (s) {
        var line = row(el('b', { text: s.title }), el('span', { class: 'muted', text: ' · ' + s.status + (s.version > 1 ? ' · version ' + s.version : '') + ' · ' + (s.chars || 0).toLocaleString('en-US') + ' characters' + (s.ref ? ' · ' + s.ref : '') + ' ' }),
          btn('read', function () { call('read', { id: s.id }, true).then(function (x) { $('view').hidden = false; $('view').textContent = x.source.title + '\n\n' + x.source.text; }).catch(fail('srcmsg')); }),
          role === 'owner' && s.status === 'proposed' ? btn('approve', function () { call('approve', { id: s.id, approve: true }).then(sources).catch(fail('srcmsg')); }) : null,
          role === 'owner' ? btn('remove', function () { if (confirm('Remove "' + s.title + '" from the harbour?')) call('remove', { id: s.id }).then(sources).catch(fail('srcmsg')); }) : null);
        box.appendChild(line);
      });
    }).catch(fail('srcmsg'));
  }
  $('add').addEventListener('submit', function (ev) {
    ev.preventDefault(); var f = ev.target; say('srcmsg', 'laying it in …');
    call('add', { title: f.title.value, ref: f.ref.value, text: f.text.value, url: f.url.value }).then(function (r) { say('srcmsg', r.note); f.reset(); sources(); enterQuiet(); }).catch(fail('srcmsg'));
  });
  function enterQuiet() { call('about', null, true).then(function (r) { $('holds').textContent = r.holds.sources + ' sources · ' + (r.holds.proposed || 0) + ' proposed · ' + r.holds.ways + ' ways · ' + r.holds.notes + ' notes · ' + r.holds.characters.toLocaleString('en-US') + ' of ' + r.holds.room.toLocaleString('en-US') + ' characters'; }).catch(function () {}); }

  // ---- try a question: what a model gets from this harbour
  $('try').addEventListener('submit', function (ev) {
    ev.preventDefault(); var box = $('hits'); clear(box); say('trymsg', 'searching …');
    call('search', { q: ev.target.q.value }, true).then(function (r) {
      say('trymsg', r.rule);
      r.passages.forEach(function (p) { box.appendChild(el('div', { class: 'box' }, el('b', { text: p.source.title + (p.source.ref ? ' · ' + p.source.ref : '') }), el('pre', { text: p.text }))); });
    }).catch(fail('trymsg'));
  });

  // ---- hold a draft against the sources
  $('chk').addEventListener('submit', function (ev) {
    ev.preventDefault(); var box = $('chkl'); clear(box); say('chkmsg', 'checking …');
    call('check', { text: ev.target.text.value }).then(function (r) {
      say('chkmsg', r.rule, r.notFound + r.figureNotInSources > 0);
      r.sentences.forEach(function (x) { box.appendChild(el('p', {}, el('b', { text: x.found === 'yes' ? 'found ' : x.found === 'partly' ? 'partly ' : x.found + ' ' }), el('span', { text: x.sentence }), el('span', { class: 'muted', text: x.source ? '  · ' + x.source.title : '' }))); });
      box.appendChild(el('p', { class: 'muted', text: r.limits }));
    }).catch(fail('chkmsg'));
  });

  // ---- ways and notes
  function ways() {
    call('ways', null, true).then(function (r) {
      var box = $('wayl'); clear(box);
      if (!r.ways.length) box.appendChild(el('p', { class: 'muted', text: 'No ways yet. Your agents lay them as they work; you can lay the first one here.' }));
      r.ways.forEach(function (w) { box.appendChild(el('div', { class: 'box' }, el('b', { text: w.task }), el('span', { class: 'muted', text: '  worked ' + w.worked + ' · failed ' + w.failed + ' · strength ' + w.strength }), el('pre', { text: w.how }))); });
    }).catch(fail('waymsg'));
  }
  $('lay').addEventListener('submit', function (ev) { ev.preventDefault(); var f = ev.target; call('lay', { task: f.task.value, how: f.how.value }).then(function () { say('waymsg', 'laid'); f.reset(); ways(); }).catch(fail('waymsg')); });
  function notes() {
    call('notes', null, true).then(function (r) {
      var box = $('notel'); clear(box);
      if (!r.notes.length) box.appendChild(el('p', { class: 'muted', text: 'No notes yet.' }));
      r.notes.forEach(function (n) { box.appendChild(el('p', {}, el('span', { text: n.text }), el('span', { class: 'muted', text: '  ' + (n.tag ? '#' + n.tag + ' · ' : '') + n.by + ' · ' + String(n.at).slice(0, 10) }))); });
    }).catch(fail('notemsg'));
  }
  $('note').addEventListener('submit', function (ev) { ev.preventDefault(); var f = ev.target; call('note', { text: f.text.value, tag: f.tag.value }).then(function () { say('notemsg', 'kept'); f.reset(); notes(); }).catch(fail('notemsg')); });

  // ---- the frame, and carrying the harbour away
  $('frame').addEventListener('submit', function (ev) { ev.preventDefault(); var f = ev.target; call('frame', { purpose: f.purpose.value, rules: lines(f.rules.value), closed: f.closed.checked }).then(function (r) { say('framemsg', 'the frame is set'); $('instr').textContent = r.instructions; }).catch(fail('framemsg')); });
  $('exp').addEventListener('click', function () {
    call('export', {}).then(function (r) { var a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' })), download: 'harbour-' + String(r.name).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.json' }); document.body.appendChild(a); a.click(); a.remove(); }).catch(fail('framemsg'));
  });
})();`;
