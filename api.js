/* Connexion, session (6 mois par appareil) et appels à l'API */
(function () {
  // refuse d'être affichée dans le cadre d'un autre site (clickjacking)
  if (window.top !== window.self) { document.documentElement.style.display = 'none'; throw new Error('Cadre refusé'); }
  var K_TOKEN = 'cdh.token', K_USER = 'cdh.user', K_EXP = 'cdh.exp';
  function lire(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function ecrire(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } }
  function $(i) { return document.getElementById(i); }
  var token = lire(K_TOKEN);
  if (token && Number(lire(K_EXP) || 0) < Date.now()) token = null;

  function appareil() {
    var ua = navigator.userAgent;
    var os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Mac/i.test(ua) ? 'Mac' : /Windows/i.test(ua) ? 'Windows' : 'Autre';
    var nav = /Firefox/i.test(ua) ? 'Firefox' : /Edg/i.test(ua) ? 'Edge' : /Chrome/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : 'Navigateur';
    return nav + ' · ' + os;
  }

  function appel(action, donnees) {
    var corps = Object.assign({ action: action }, donnees || {});
    if (token && action !== 'login' && action !== 'signup' && action !== 'info') corps.token = token;
    return fetch(window.CDH_API, { method: 'POST', body: JSON.stringify(corps), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', cache: 'no-store', referrerPolicy: 'no-referrer' })
      .then(function (r) { if (!r.ok) throw new Error('Réseau'); return r.json(); })
      .catch(function () { return { ok: false, err: 'Pas de connexion, réessaie.' }; })
      .then(function (rep) {
        if (rep.ok) return rep.data;
        if (rep.code === 'AUTH') { fermerSession(); montrer('login'); }
        if (rep.code === 'PIN') montrer('pin');
        var e = new Error(rep.err || 'Erreur'); e.code = rep.code; throw e;
      });
  }
  window.cdhApi = appel;

  /* Imitation de google.script.run pour garder le code de l'appli */
  function chaine() {
    var ok = function () { }, ko = function () { };
    var c = new Proxy({}, {
      get: function (t, nom) {
        if (nom === 'withSuccessHandler') return function (f) { ok = f; return c; };
        if (nom === 'withFailureHandler') return function (f) { ko = f; return c; };
        return function () {
          var args = [].slice.call(arguments);
          appel('run', { fn: nom, args: args }).then(function (d) { ok(d); }, function (e) { ko(e); });
        };
      }
    });
    return c;
  }
  window.google = { script: {} };
  Object.defineProperty(window.google.script, 'run', { get: chaine });

  function ouvrirSession(d) {
    token = d.token;
    ecrire(K_TOKEN, d.token); ecrire(K_EXP, String(d.expire)); ecrire(K_USER, JSON.stringify(d.user));
  }
  function fermerSession() { token = null; ecrire(K_TOKEN, null); ecrire(K_EXP, null); ecrire(K_USER, null); }
  window.cdhDeconnexion = function (tous) {
    var fin = function () { fermerSession(); location.reload(); };
    appel(tous ? 'logoutAll' : 'logout').then(fin, fin);
  };
  window.cdhUtilisateur = function () { try { return JSON.parse(lire(K_USER) || 'null'); } catch (e) { return null; } };

  function montrer(ecran) {
    $('demarrage').hidden = true;
    $('auth').hidden = ecran === 'app'; $('app').hidden = ecran !== 'app';
    $('fLogin').hidden = ecran !== 'login'; $('fInscr').hidden = ecran !== 'signup'; $('fNewPin').hidden = ecran !== 'pin';
    if (ecran === 'signup') appel('info').then(function (i) {
      if (!i.inscription) { $('sMsg').textContent = 'Les inscriptions sont fermées pour le moment.'; }
    }, function () { });
  }
  function demarrerAppli(u) {
    if (u && u.mustChange) { montrer('pin'); return; }
    montrer('app');
    if (u && u.nom) $('titreNom').textContent = 'Calcul des heures · ' + u.nom;
    window.charger('');
  }
  function occupe(form, oui) { [].forEach.call(form.querySelectorAll('button,input'), function (x) { x.disabled = oui; }); }
  function pinOk(p) { return /^\d{6}$/.test(p); }

  $('fLogin').onsubmit = function (ev) {
    ev.preventDefault();
    var f = this, pin = $('lPin').value;
    $('lMsg').textContent = '';
    if (!pinOk(pin)) { $('lMsg').textContent = 'Le code PIN a 6 chiffres.'; return; }
    occupe(f, true);
    appel('login', { id: $('lId').value.trim().toLowerCase(), pin: pin, device: appareil() }).then(function (d) {
      ouvrirSession(d); $('lPin').value = ''; occupe(f, false); demarrerAppli(d.user);
    }, function (e) { occupe(f, false); $('lPin').value = ''; $('lMsg').textContent = e.message; });
  };
  $('fInscr').onsubmit = function (ev) {
    ev.preventDefault();
    var f = this, p1 = $('sPin').value, p2 = $('sPin2').value;
    $('sMsg').textContent = '';
    if (!pinOk(p1)) { $('sMsg').textContent = 'Le code PIN doit avoir 6 chiffres.'; return; }
    if (p1 !== p2) { $('sMsg').textContent = 'Les deux codes ne sont pas identiques.'; return; }
    occupe(f, true);
    appel('signup', { invite: $('sInv').value.trim(), nom: $('sNom').value.trim(), id: $('sId').value.trim().toLowerCase(), pin: p1, device: appareil() }).then(function (d) {
      ouvrirSession(d); occupe(f, false); demarrerAppli(d.user);
    }, function (e) { occupe(f, false); $('sMsg').textContent = e.message; });
  };
  $('fNewPin').onsubmit = function (ev) {
    ev.preventDefault();
    var f = this, p1 = $('nPin').value, p2 = $('nPin2').value;
    $('nMsg').textContent = '';
    if (!pinOk(p1)) { $('nMsg').textContent = 'Le code PIN doit avoir 6 chiffres.'; return; }
    if (p1 !== p2) { $('nMsg').textContent = 'Les deux codes ne sont pas identiques.'; return; }
    occupe(f, true);
    appel('pin', { nouveau: p1 }).then(function () {
      var u = window.cdhUtilisateur() || {}; u.mustChange = false; ecrire(K_USER, JSON.stringify(u));
      occupe(f, false); $('nPin').value = $('nPin2').value = ''; demarrerAppli(u);
    }, function (e) { occupe(f, false); $('nMsg').textContent = e.message; });
  };
  $('versInscr').onclick = function () { montrer('signup'); };
  $('versLogin').onclick = function () { montrer('login'); };

  window.addEventListener('DOMContentLoaded', function () {
    if (!token) { montrer('login'); return; }
    appel('me').then(function (d) { ecrire(K_USER, JSON.stringify(d.user)); demarrerAppli(d.user); }, function () { });
  });
})();
