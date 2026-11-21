// Mare Liberum · the shipyard's desk — the small program the /yard page runs in a person's browser
// A person picks a blueprint, names the agent, says what it is for, and takes the five files home. Nothing is stored
// on the node: a build is an answer. What comes back is put on the page as text, never as markup.
// (Plain script without template literals, so it can travel inside the page as it is.)
export const YARD_UI = String.raw`(function () {
  var B = location.origin, built = null;
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs) {
    var e = document.createElement(tag), k, i; attrs = attrs || {};
    for (k in attrs) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'click') e.addEventListener('click', attrs[k]); else e.setAttribute(k, attrs[k]); }
    for (i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    return e;
  }
  function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); }
  function say(msg, bad) { var e = $('ymsg'); e.textContent = msg || ''; e.style.color = bad ? '#ff9b6b' : '#9fd7ff'; }
  function save(name, text) { var a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/plain' })), download: name }); document.body.appendChild(a); a.click(); a.remove(); }
  document.querySelectorAll('[data-kind]').forEach(function (b) { b.addEventListener('click', function () { $('build').kind.value = b.getAttribute('data-kind'); $('build').scrollIntoView({ behavior: 'smooth' }); $('build').name.focus(); }); });
  $('build').addEventListener('submit', function (ev) {
    ev.preventDefault(); var f = ev.target; say('building …');
    var rules = String(f.rules.value || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    fetch(B + '/yard/build', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ name: f.name.value, kind: f.kind.value, purpose: f.purpose.value, rules: rules, language: f.language.value, harbour: f.harbour.checked || undefined }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error((j.error && j.error.message) || ('error ' + r.status)); return j; }); })
      .then(function (r) {
        built = r; say('Built. Put the files into a folder of their own.');
        var box = $('ship'); clear(box); box.hidden = false;
        box.appendChild(el('h3', { text: r.agent.name + ' · ' + r.agent.kind }));
        var row = el('p', {}); Object.keys(r.files).forEach(function (name) { row.appendChild(el('button', { type: 'button', text: name, click: function () { save(name, r.files[name]); } })); }); box.appendChild(row);
        box.appendChild(el('p', { class: 'muted', text: 'May use: ' + r.agent.tools.allow.join(', ') + (r.agent.tools.ask.length ? ' · asks first: ' + r.agent.tools.ask.join(', ') : '') }));
        box.appendChild(el('pre', { text: r.run.join('\n') }));
        box.appendChild(el('h3', { text: 'Its frame, for Claude or ChatGPT instead of the program' })); box.appendChild(el('pre', { text: r.files['AGENT.md'] }));
      }).catch(function (e) { say(e.message || 'that did not work', true); });
  });
})();`;
