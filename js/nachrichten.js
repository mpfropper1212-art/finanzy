// Wirtschaftsmeldungen auf der Startseite.
//
// Die Datei kommt aus dem eigenen Repo und wird einmal täglich von einem
// GitHub-Ablauf erneuert. Direkt aus dem Browser ginge es nicht: die Feeds
// senden keine CORS-Header, der Abruf würde abgelehnt.

import { el, clear } from './util.js';

const QUELLE = 'daten/nachrichten.json';

function alterText(iso) {
  if (!iso) return '';
  const dann = new Date(iso);
  if (Number.isNaN(dann.getTime())) return '';

  const minuten = Math.round((Date.now() - dann.getTime()) / 60000);
  if (minuten < 1) return 'gerade eben';
  if (minuten < 60) return `vor ${minuten} Min`;
  const stunden = Math.round(minuten / 60);
  if (stunden < 24) return `vor ${stunden} Std`;
  const tage = Math.round(stunden / 24);
  if (tage === 1) return 'gestern';
  if (tage < 7) return `vor ${tage} Tagen`;
  return dann.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export async function renderNachrichten(host) {
  clear(host);

  const kopf = el('div', { class: 'news-kopf' });
  kopf.appendChild(el('h3', {}, 'Wirtschaft heute'));
  const stand = el('span', { class: 'news-stand' }, 'lädt …');
  kopf.appendChild(stand);
  host.appendChild(kopf);

  const liste = el('div', { class: 'news-liste' });
  host.appendChild(liste);

  let daten;
  try {
    const antwort = await fetch(QUELLE, { cache: 'no-cache' });
    if (!antwort.ok) throw new Error(String(antwort.status));
    daten = await antwort.json();
  } catch {
    stand.textContent = '';
    liste.appendChild(el('p', { class: 'feld-hinweis' },
      'Die Meldungen konnten nicht geladen werden. Sie werden einmal täglich erneuert – '
      + 'morgen steht hier wieder etwas.'));
    return;
  }

  const meldungen = Array.isArray(daten?.meldungen) ? daten.meldungen : [];
  if (!meldungen.length) {
    stand.textContent = '';
    liste.appendChild(el('p', { class: 'feld-hinweis' }, 'Gerade keine Meldungen.'));
    return;
  }

  stand.textContent = daten.stand ? `Stand ${alterText(daten.stand)}` : '';

  for (const m of meldungen.slice(0, 6)) {
    const zeile = el('a', {
      class: 'news-zeile',
      href: m.link,
      target: '_blank',
      rel: 'noopener noreferrer',
    });
    zeile.append(
      el('span', { class: 'news-titel' }, m.titel),
      el('span', { class: 'news-meta' }, [m.quelle, alterText(m.zeit)].filter(Boolean).join(' · ')),
    );
    liste.appendChild(zeile);
  }
}
