var D = null; var enCours = 0;
function $(i) { return document.getElementById(i); }
function fmt(n) { return (Math.round(n * 100) / 100).toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtH(n) { return (Math.round(n * 100) / 100).toLocaleString('fr-CH', { maximumFractionDigits: 2 }); }
function etat(t, dur) { var e = $('etat'); e.textContent = t; e.classList.add('vis'); clearTimeout(e._t); if (dur) e._t = setTimeout(function () { e.classList.remove('vis'); }, dur); }
function occupe() { enCours++; etat('Enregistrement…'); }
function fini() { enCours--; if (enCours <= 0) { enCours = 0; etat('Enregistré ✓', 1200); } }
function erreur(e) { enCours = 0; etat('Erreur : ' + (e && e.message ? e.message : e), 5000); }
function charger(label) {
  $('liste').innerHTML = '<div class="charge">Chargement…</div>';
  google.script.run.withSuccessHandler(afficher).withFailureHandler(erreur).appMois(label || '');
}
function sauverJour(j) {
  occupe();
  google.script.run.withSuccessHandler(function (p) { fini(); majPoints(p); }).withFailureHandler(erreur)
    .appSauverJour(j.key, j.heures, j.coche, j.ent, j.st || '', j.pen || '', j.cr === undefined ? '' : j.cr);
}
/* Statuts d'un jour (pour les points) */
var STATUTS = [
  { v: '', t: 'Cours donné', d: 'Normal : le ✓ indique que tu as donné le cours.' },
  { v: 'ret', t: 'En retard', d: 'Cours donné, mais −1 point.' },
  { v: 'rem', t: 'Remplacé·e', d: 'Par un prof qui ne travaillait pas, validé par Patrick. Le créneau compte, seul le bonus de la semaine est perdu. Pas d’heures payées.' },
  { v: 'abs', t: 'Absence annoncée', d: 'Absence justifiée ou annoncée à temps : pas de pénalité, mais le créneau n’est pas fait (moins de points, pas de bonus).' },
  { v: 'nja', t: 'Absence non annoncée', d: 'Non justifiée ou annoncée trop tard : le créneau n’est pas fait et Patrick retire de 1 à 5 points.' },
  { v: 'off', t: 'Pas prévu', d: 'Vacances, jour férié, congé convenu : ce jour ne compte pas du tout (le bonus reste possible).' }
];
function nomStatut(v) { for (var i = 0; i < STATUTS.length; i++) if (STATUTS[i].v === v) return STATUTS[i].t; return ''; }
function creneauxStd(j) { return D.points ? D.points.cfg.cren[j.wd] : 0; }
function creneaux(j) { return j.cr !== '' && j.cr !== undefined ? j.cr : creneauxStd(j); }
function libelleJour(j) {
  var n = creneaux(j), x = n > 1 ? ' (' + n + ' créneaux)' : '';
  if (j.st === 'ret') return { c: 'ret', t: '⏰ En retard · −1 pt' };
  if (j.st === 'rem') return { c: 'rem', t: '🔁 Remplacé·e' + x };
  if (j.st === 'abs') return { c: 'abs', t: '📩 Absence annoncée' + x };
  if (j.st === 'nja') return { c: 'nja', t: '⚠️ Absence non annoncée · −' + (j.pen || 1) + ' pt' + ((j.pen || 1) > 1 ? 's' : '') };
  if (j.st === 'off') return { c: 'off', t: '🏖 Pas prévu (ne compte pas)' };
  if (j.cr !== '' && j.cr !== undefined) return { c: 'info', t: n + ' créneau' + (n > 1 ? 'x' : '') + ' ce jour' };
  return null;
}
function prixEnt(jours) {
  var t = D.tarif, sem = {}, n = 0, tot = 0;
  jours.forEach(function (j) { if (j.ent) { n++; var w = j._sw; sem[w] = (sem[w] || 0) + 1; } });
  Object.keys(sem).forEach(function (w) { tot += Math.min(sem[w] * t.jour, t.sem); });
  return { n: n, prix: Math.min(tot, t.mois) };
}
function totaux() {
  var h = 0;
  D.jours.forEach(function (j) { if (j.coche && j.heures !== '') h += Number(j.heures); });
  $('tH').textContent = fmtH(h);
  var th = parseFloat(String($('th').value).replace(',', '.'));
  $('tM').textContent = isNaN(th) ? '–' : fmt(h * th);
  var e = prixEnt(D.jours);
  $('eN').textContent = e.n + (e.n > 1 ? ' jours' : ' jour');
  $('eP').textContent = fmt(e.prix) + ' CHF';
}
function sem() {
  var t = {};
  D.jours.forEach(function (j) { t[j._sw] = (t[j._sw] || 0) + (j.coche && j.heures !== '' ? Number(j.heures) : 0); });
  Object.keys(t).forEach(function (k) { var e = $(k); if (e) e.textContent = fmtH(t[k]) + ' h'; });
}
function lundiDe(key) {
  var a = key.split('-'), t = Date.UTC(+a[0], a[1] - 1, +a[2]);
  return new Date(t - ((new Date(t).getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
}
function signe(n) { return (n > 0 ? '+' : '') + n; }
function pl(n, s) { return n + ' ' + s + (Math.abs(n) > 1 ? 's' : ''); }
function majPoints(P) {
  if (!P || !P.semaines) return;
  D.points = P;
  $('pT').textContent = P.total + ' pts';
  $('pH').textContent = P.hausse > 0 ? '+' + P.hausse + ' CHF/h' + (P.hausseDes ? ' dès ' + P.hausseDes.toLowerCase() : '') : 'Pas encore de hausse';
  $('pM').textContent = 'encore ' + Math.max(P.manque, 0) + ' pts avant +' + (P.hausse + 1) + ' CHF/h';
  $('pG').style.width = Math.max(0, Math.min(100, 100 * (P.palier - P.manque) / P.palier)) + '%';
  [].forEach.call(document.querySelectorAll('button.pt'), function (b) {
    var s = P.semaines[b.dataset.l];
    b.style.visibility = s ? 'visible' : 'hidden';
    if (s) {
      b.textContent = signe(s.pts) + ' pt' + (Math.abs(s.pts) > 1 ? 's' : '') + (s.enCours ? ' · en cours' : '');
      b.classList.toggle('neg', s.pts < 0);
    }
    var ed = $('ed' + b.dataset.l);
    if (ed && ed.classList.contains('vis')) remplirEd(ed, b.dataset.l);
  });
  D.jours.forEach(function (j) { if (j._maj) j._maj(); });
}
function remplirEd(ed, l) {
  var s = D.points.semaines[l]; if (!s) return;
  var nb = s.faits + s.rempl;
  var h = '<table>' +
    '<tr><td>Créneaux prévus</td><td><b>' + s.prev + '</b>' + (s.off ? ' <span class="g">(' + s.off + ' pas prévu)</span>' : '') + '</td></tr>' +
    '<tr><td>Créneaux donnés' + (s.rempl ? ' + remplacés' : '') + '</td><td><b>' + nb + '</b>' + (s.rempl ? ' <span class="g">(dont ' + s.rempl + ' remplacé' + (s.rempl > 1 ? 's' : '') + ')</span>' : '') + '</td></tr>';
  if (s.abs) h += '<tr><td>Créneaux en absence annoncée</td><td>' + s.abs + '</td></tr>';
  if (s.nja) h += '<tr><td>Créneaux en absence non annoncée</td><td>' + s.nja + '</td></tr>';
  if (s.manques) h += '<tr><td>Créneaux pas cochés</td><td>' + s.manques + (s.enCours ? ' <span class="g">(semaine en cours)</span>' : '') + '</td></tr>';
  h += '</table><div class="calc">' +
    '<span>' + pl(s.base, 'pt') + ' <i>(' + nb + ' créneau' + (nb > 1 ? 'x' : '') + ')</i></span>' +
    '<span>' + (s.bonus ? '+1 bonus' : '<s>bonus</s>') + '</span>' +
    (s.ret ? '<span class="m">−' + s.ret + ' retard' + (s.ret > 1 ? 's' : '') + '</span>' : '') +
    (s.penAbs ? '<span class="m">−' + s.penAbs + ' absence</span>' : '') +
    '<span class="tot">= ' + signe(s.pts) + '</span></div>';
  if (!s.bonus && s.prev > 0 && !s.rempl && nb < s.prev) h += '<p class="g">Bonus : il faut faire les ' + s.prev + ' créneaux prévus.</p>';
  if (s.rempl) h += '<p class="g">Bonus perdu à cause du remplacement (règle).</p>';
  if (s.ancien) h += '<p class="g">Cette semaine contient une ancienne saisie manuelle. <button class="lien" data-eff="1">Effacer</button></p>';
  h += '<p class="g">Rappel : 6 créneaux = 3 pts · 5 = 2 pts · 3-4 = 1 pt · +1 bonus si tout ce qui était prévu est fait.</p>';
  ed.innerHTML = h;
  var b = ed.querySelector('[data-eff]');
  if (b) b.onclick = function () { occupe(); google.script.run.withSuccessHandler(function (p) { fini(); majPoints(p); }).withFailureHandler(erreur).appSauverSemaine(l, '', 0, 0, 0); };
}
function panneauJour(j, r) {
  var p = document.createElement('div'); p.className = 'dayEd';
  function dessiner() {
    var h = '<div class="tt">Que s’est-il passé le ' + j.jour.toLowerCase() + ' ' + j.num + ' ?</div><div class="chips">';
    STATUTS.forEach(function (s) { h += '<button data-st="' + s.v + '" class="' + ((j.st || '') === s.v ? 'on' : '') + '">' + s.t + '</button>'; });
    h += '</div><p class="g">' + STATUTS.filter(function (s) { return s.v === (j.st || ''); })[0].d + '</p>';
    if (j.st === 'nja') {
      h += '<div class="lig"><span>Points retirés (décidé par Patrick)</span><span class="chips pen">';
      for (var k = 1; k <= 5; k++) h += '<button data-pen="' + k + '" class="' + ((j.pen || 1) === k ? 'on' : '') + '">−' + k + '</button>';
      h += '</span></div>';
    }
    if (j.st !== 'off') {
      var n = creneaux(j);
      h += '<div class="lig"><span>Créneaux ce jour' + (creneauxStd(j) !== n ? ' <i>(normal : ' + creneauxStd(j) + ')</i>' : '') + '</span><span class="stp"><button data-cr="-1">−</button><b>' + n + '</b><button data-cr="1">+</button></span></div>';
    }
    h += '<div class="lig fin"><button class="ok">Fermer</button></div>';
    p.innerHTML = h;
    [].forEach.call(p.querySelectorAll('[data-st]'), function (b) {
      b.onclick = function () {
        j.st = b.dataset.st;
        if (j.st === '' || j.st === 'ret') j.coche = true; else j.coche = false;
        if (j.st === 'nja' && !j.pen) j.pen = 1;
        if (j.st !== 'nja') j.pen = '';
        r.classList.toggle('ok', j.coche); totaux(); sem(); sauverJour(j); j._maj(); dessiner();
      };
    });
    [].forEach.call(p.querySelectorAll('[data-pen]'), function (b) { b.onclick = function () { j.pen = Number(b.dataset.pen); sauverJour(j); j._maj(); dessiner(); }; });
    [].forEach.call(p.querySelectorAll('[data-cr]'), function (b) {
      b.onclick = function () {
        var n = Math.max(0, creneaux(j) + Number(b.dataset.cr));
        j.cr = n === creneauxStd(j) ? '' : n; sauverJour(j); j._maj(); dessiner();
      };
    });
    p.querySelector('.ok').onclick = function () { p.classList.remove('vis'); };
  }
  p._dessiner = dessiner;
  return p;
}
function afficher(d) {
  D = d;
  var s = $('mois'); s.innerHTML = '';
  d.mois.forEach(function (m) { var o = document.createElement('option'); o.value = m; o.textContent = m; if (m === d.label) o.selected = true; s.appendChild(o); });
  $('th').value = d.th === '' ? '' : d.th;
  $('eCat').textContent = d.tarif.cat;
  var L = $('liste'); L.innerHTML = ''; var bloc = null;
  d.jours.forEach(function (j, i) {
    if (!bloc || j.wd === 0) {
      var t = document.createElement('div'); t.className = 'semaine';
      var lu = lundiDe(j.key);
      t.innerHTML = '<span>Semaine du ' + j.num + '</span><span class="sr"><span id="sw' + i + '"></span><button class="pt" data-l="' + lu + '" aria-label="Points de la semaine"></button></span>';
      L.appendChild(t);
      var ed = document.createElement('div'); ed.className = 'semEd'; ed.id = 'ed' + lu; L.appendChild(ed);
      t.querySelector('.pt').onclick = function () { ed.classList.toggle('vis'); if (ed.classList.contains('vis')) remplirEd(ed, lu); };
      bloc = document.createElement('div'); bloc.className = 'jours'; L.appendChild(bloc);
      j._sw = 'sw' + i;
    } else { j._sw = d.jours[i - 1]._sw; }
    var r = document.createElement('div');
    r.className = 'jour' + (j.coche ? ' ok' : '') + (j.ent ? ' en' : '') + (j.key === d.aujourdhui ? ' auj' : '');
    r.innerHTML = '<button class="date" aria-label="Préciser ce jour"><div class="j">' + j.jour.slice(0, 3) + '</div><div class="n">' + j.num + '</div><div class="dot">•••</div></button>' +
      '<div class="pas"><button class="m" aria-label="Moins">−</button><input type="number" inputmode="decimal" step="0.5" min="0"><button class="p" aria-label="Plus">+</button></div>' +
      '<button class="ent" aria-label="Entraînement libre" title="Entraînement libre">🤸</button>' +
      '<button class="coche" aria-label="Cours comptabilisé">✓</button><div class="tag"></div>';
    var inp = r.querySelector('input'); inp.value = j.heures === '' ? '' : j.heures;
    var tag = r.querySelector('.tag');
    j._maj = function () {
      var l = D.points ? libelleJour(j) : null;
      tag.className = 'tag' + (l ? ' vis ' + l.c : ''); tag.textContent = l ? l.t : '';
      r.classList.toggle('st', !!(j.st));
    };
    function maj(v) { j.heures = v; inp.value = v === '' ? '' : v; totaux(); sem(); sauverJour(j); }
    r.querySelector('.m').onclick = function () { var v = Number(j.heures || 0) - 0.5; maj(v < 0 ? 0 : v); };
    r.querySelector('.p').onclick = function () { maj(Number(j.heures || 0) + 0.5); };
    inp.onchange = function () { var v = String(inp.value).replace(',', '.'); maj(v === '' ? '' : Math.max(0, Number(v))); };
    r.querySelector('.coche').onclick = function () {
      j.coche = !j.coche;
      if (j.coche && ['rem', 'abs', 'nja', 'off'].indexOf(j.st) >= 0) { j.st = ''; j.pen = ''; }
      if (!j.coche && j.st === 'ret') j.st = '';
      r.classList.toggle('ok', j.coche); totaux(); sem(); sauverJour(j); j._maj();
      if (pj.classList.contains('vis')) pj._dessiner();
    };
    r.querySelector('.ent').onclick = function () { j.ent = !j.ent; r.classList.toggle('en', j.ent); totaux(); sauverJour(j); };
    bloc.appendChild(r);
    var pj = panneauJour(j, r); bloc.appendChild(pj);
    r.querySelector('.date').onclick = function () {
      if (!ptsActifs()) return;
      var ouvert = pj.classList.contains('vis');
      [].forEach.call(document.querySelectorAll('.dayEd.vis'), function (x) { x.classList.remove('vis'); });
      if (!ouvert) { pj._dessiner(); pj.classList.add('vis'); }
    };
  });
  sem(); totaux(); majPoints(d.points);
  if (d.points && d.points.cfg.skin && d.points.cfg.skin !== skinActuel()) window.cdhSkin(d.points.cfg.skin);
  appliquerPts();
  var a = document.querySelector('.auj'); if (a) a.scrollIntoView({ block: 'center' });
}
$('mois').onchange = function () { charger(this.value); };
$('prec').onclick = function () { var s = $('mois'); if (s.selectedIndex > 0) { s.selectedIndex--; charger(s.value); } };
$('suiv').onclick = function () { var s = $('mois'); if (s.selectedIndex < s.options.length - 1) { s.selectedIndex++; charger(s.value); } };
$('th').onchange = function () {
  var v = String(this.value).replace(',', '.'); D.th = v === '' ? '' : Number(v); totaux(); occupe();
  google.script.run.withSuccessHandler(fini).withFailureHandler(erreur).appSauverTH(D.label, D.th);
};
$('th').oninput = totaux;
/* ---------- Apparences ---------- */
var SKINS = [
  { v: 'rose', t: 'Rose', c: ['#ead1dc', '#6d2d4d', '#674ea7'] },
  { v: 'nuit', t: 'Nuit', c: ['#1f1a22', '#e48bb6', '#9b7fe0'] },
  { v: 'ocean', t: 'Océan', c: ['#cfe6f4', '#1d5c88', '#2b8a9a'] },
  { v: 'foret', t: 'Forêt', c: ['#d5eada', '#2e6a46', '#7a8f3a'] },
  { v: 'soleil', t: 'Soleil', c: ['#fde3ae', '#b5601a', '#c0503a'] },
  { v: 'chapiteau', t: 'Chapiteau', c: ['#c8323c', '#fff8ee', '#d4a017'] },
  { v: 'lavande', t: 'Lavande', c: ['#e4dcf6', '#5a42a0', '#c0558f'] },
  { v: 'encre', t: 'Encre', c: ['#222', '#f4f4f4', '#888'] }
];
function skinActuel() { return document.documentElement.getAttribute('data-skin') || 'rose'; }
function dessinerSkins() {
  var cur = skinActuel(), h = '';
  SKINS.forEach(function (s) {
    h += '<button data-skin-v="' + s.v + '" class="' + (s.v === cur ? 'on' : '') + '" aria-pressed="' + (s.v === cur) + '"><span class="ech"><i style="background:' + s.c[0] + '"></i><i style="background:' + s.c[1] + '"></i><i style="background:' + s.c[2] + '"></i></span>' + s.t + '</button>';
  });
  $('skins').innerHTML = h;
  [].forEach.call($('skins').querySelectorAll('button'), function (b) {
    b.onclick = function () {
      var v = b.dataset.skinV; window.cdhSkin(v); dessinerSkins(); occupe();
      google.script.run.withSuccessHandler(function (cfg) { fini(); if (D && D.points) D.points.cfg = cfg; }).withFailureHandler(erreur).appSauverOptions(null, v);
    };
  });
}
/* ---------- Système de points oui / non ---------- */
function ptsActifs() { return !D || !D.points || D.points.cfg.actif !== false; }
function appliquerPts() {
  var on = ptsActifs();
  document.body.classList.toggle('sansPts', !on);
  if ($('ptOn')) {
    $('ptOn').checked = on; $('ptCfg').hidden = !on;
    $('ptOnTxt').textContent = on ? 'Activé : les points s’affichent sur l’écran principal.' : 'Désactivé : les points sont cachés. Tes saisies restent enregistrées, tu peux le réactiver quand tu veux.';
  }
}
$('ptOn').onchange = function () {
  var on = this.checked; if (D && D.points) D.points.cfg.actif = on; appliquerPts(); occupe();
  google.script.run.withSuccessHandler(function (cfg) { fini(); if (D && D.points) D.points.cfg = cfg; appliquerPts(); }).withFailureHandler(erreur).appSauverOptions(on, null);
};
/* ---------- Fenêtre Paramètres ---------- */
function ouvrirReg() {
  if (!D) return;
  var h = '';
  ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(function (n, i) {
    h += '<div><label>' + n + '</label><input type="number" inputmode="decimal" step="0.5" min="0" value="' + (D.defauts[i] === '' ? '' : D.defauts[i]) + '"></div>';
  });
  $('defs').innerHTML = h;
  var sel = $('cat'); sel.innerHTML = '';
  D.tarif.cats.forEach(function (n) { var o = document.createElement('option'); o.value = n; o.textContent = n; if (n === D.tarif.cat) o.selected = true; sel.appendChild(o); });
  if (D.url) { $('lien').href = D.url; $('lien').hidden = false; } else $('lien').hidden = true;
  compte();
  var PT = D.points, c = '';
  ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(function (n, i) {
    c += '<div><label>' + n + '</label><input type="number" inputmode="numeric" min="0" value="' + PT.cfg.cren[i] + '"></div>';
  });
  $('cren').innerHTML = c; $('pDeb').value = PT.cfg.debut; $('pDep').value = PT.cfg.depart;
  dessinerSkins(); appliquerPts();
  $('fenetre').hidden = false; document.body.classList.add('modale');
  $('panneau').scrollTop = 0; $('fermer').focus();
}
function fermerReg() { $('fenetre').hidden = true; document.body.classList.remove('modale'); }
$('reg').onclick = ouvrirReg;
$('fermer').onclick = fermerReg;
$('fenetre').onclick = function (e) { if (e.target === this) fermerReg(); };
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('fenetre').hidden) fermerReg(); });
$('okDef').onclick = function () {
  var v = [].map.call(document.querySelectorAll('#defs input'), function (i) { var x = String(i.value).replace(',', '.'); return x === '' ? '' : Number(x); });
  occupe();
  google.script.run.withSuccessHandler(function () { fini(); fermerReg(); charger(D.label); }).withFailureHandler(erreur).appSauverReglages(v, $('cat').value);
};
$('okPts').onclick = function () {
  var cr = [].map.call(document.querySelectorAll('#cren input'), function (i) { return Number(i.value) || 0; });
  occupe();
  google.script.run.withSuccessHandler(function () { fini(); fermerReg(); charger(D.label); }).withFailureHandler(erreur).appSauverPoints($('pDeb').value, $('pDep').value, cr);
};
window.charger = charger;

/* ---------- Mon compte et administration ---------- */
function compte() {
  var u = window.cdhUtilisateur() || {};
  $('moiInfo').textContent = 'Connecté·e : ' + (u.nom || '') + ' (' + (u.id || '') + ')';
  window.cdhApi('me').then(function (d) {
    $('moiInfo').textContent = 'Connecté·e : ' + d.user.nom + ' (' + d.user.id + ') · ' + d.appareils + ' appareil' + (d.appareils > 1 ? 's' : '') + ' connecté' + (d.appareils > 1 ? 's' : '');
  }, function () { });
  $('adminBloc').hidden = !u.admin;
  if (u.admin) window.cdhApi('admin_infos').then(admin, erreur);
}
function admin(d) {
  $('admMode').value = d.mode; $('admCode').textContent = d.mode === 'code' ? d.invitation : '—';
  if (d.url) { $('lien').href = d.url; $('lien').hidden = false; }
  var L = $('admUsers'); L.textContent = '';
  d.utilisateurs.forEach(function (u) {
    var l = document.createElement('div'); l.className = 'uLigne' + (u.actif ? '' : ' off');
    var g = document.createElement('div');
    var n = document.createElement('div'); n.className = 'n'; n.textContent = u.nom + (u.admin ? ' (admin)' : '');
    var i = document.createElement('div'); i.className = 'g'; i.textContent = u.id + (u.vu ? ' · vu le ' + u.vu : '');
    g.appendChild(n); g.appendChild(i); l.appendChild(g);
    if (!u.admin) {
      var bt = document.createElement('div'); bt.className = 'bt';
      var b1 = document.createElement('button'); b1.textContent = 'Nouveau code';
      b1.onclick = function () {
        if (!confirm('Créer un code provisoire pour ' + u.nom + ' ? Ses appareils seront déconnectés.')) return;
        window.cdhApi('admin_reset', { id: u.id }).then(function (r) { alert('Code provisoire pour ' + r.id + ' : ' + r.code + '\nIl/elle choisira son propre code à la connexion.'); }, erreur);
      };
      var b2 = document.createElement('button'); b2.textContent = u.actif ? 'Désactiver' : 'Réactiver';
      b2.onclick = function () { if (!confirm((u.actif ? 'Désactiver ' : 'Réactiver ') + u.nom + ' ?')) { return; } window.cdhApi('admin_actif', { id: u.id, actif: !u.actif }).then(admin, erreur); };
      bt.appendChild(b1); bt.appendChild(b2); l.appendChild(bt);
    }
    L.appendChild(l);
  });
}
$('admMode').onchange = function () { var v = this.value; if (!confirm('Changer le mode d’inscription ?')) { compte(); return; } window.cdhApi('admin_mode', { mode: v }).then(admin, erreur); };
$('admNewCode').onclick = function () { if (!confirm('Créer un nouveau code d’invitation ? L’ancien ne marchera plus.')) return; window.cdhApi('admin_invitation').then(admin, erreur); };
$('okPin').onclick = function () {
  var a = $('pinOld').value, n = $('pinNew').value;
  if (!/^\d{6}$/.test(n)) { etat('Le nouveau code doit avoir 6 chiffres', 3000); return; }
  occupe();
  window.cdhApi('pin', { ancien: a, nouveau: n }).then(function () { fini(); $('pinOld').value = $('pinNew').value = ''; etat('Code PIN changé ✓ (autres appareils déconnectés)', 3000); compte(); }, erreur);
};
$('deco').onclick = function () { window.cdhDeconnexion(false); };
$('decoTout').onclick = function () { if (confirm('Déconnecter tous tes appareils, y compris celui-ci ?')) window.cdhDeconnexion(true); };
