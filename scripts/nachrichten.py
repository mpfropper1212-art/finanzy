#!/usr/bin/env python3
"""Holt Wirtschaftsmeldungen aus RSS-Feeds und legt sie als JSON ab.

Läuft einmal täglich über GitHub Actions, nicht im Browser: die Feeds senden
keine CORS-Header, eine Seite auf github.io darf sie also gar nicht abrufen.
Das Ergebnis liegt danach im selben Repo und wird von der App wie jede andere
Datei geladen - ohne fremden Dienst, ohne Schlüssel, ohne Kosten.

Nur Standardbibliothek, damit auf dem Runner nichts installiert werden muss.
"""

from __future__ import annotations

import json
import pathlib
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

QUELLEN = [
    ("tagesschau", "https://www.tagesschau.de/wirtschaft/index~rss2.xml"),
    ("Spiegel", "https://www.spiegel.de/wirtschaft/index.rss"),
]

ANZAHL = 8
ZIEL = pathlib.Path(__file__).resolve().parent.parent / "daten" / "nachrichten.json"
KOPF = {"User-Agent": "Finanzy/1.0 (persoenliche Finanz-App; RSS-Abruf einmal taeglich)"}


def hole(url: str) -> bytes | None:
    try:
        anfrage = urllib.request.Request(url, headers=KOPF)
        with urllib.request.urlopen(anfrage, timeout=20) as antwort:
            return antwort.read()
    except (urllib.error.URLError, TimeoutError, OSError) as fehler:
        print(f"  Abruf fehlgeschlagen: {fehler}", file=sys.stderr)
        return None


def saeubere(text: str) -> str:
    """HTML-Reste und doppelte Leerzeichen aus einem Titel entfernen."""
    ohne_tags = re.sub(r"<[^>]+>", "", text or "")
    return re.sub(r"\s+", " ", ohne_tags).strip()


def zeitstempel(eintrag: ET.Element) -> str:
    roh = (eintrag.findtext("pubDate") or "").strip()
    if not roh:
        return ""
    try:
        zeit = parsedate_to_datetime(roh)
    except (TypeError, ValueError):
        return ""
    if zeit.tzinfo is None:
        zeit = zeit.replace(tzinfo=timezone.utc)
    return zeit.astimezone(timezone.utc).isoformat(timespec="seconds")


def meldungen_aus(quelle: str, rohdaten: bytes) -> list[dict]:
    try:
        wurzel = ET.fromstring(rohdaten)
    except ET.ParseError as fehler:
        print(f"  Feed unlesbar: {fehler}", file=sys.stderr)
        return []

    gefunden = []
    for eintrag in wurzel.iter("item"):
        titel = saeubere(eintrag.findtext("title") or "")
        link = (eintrag.findtext("link") or "").strip()
        if not titel or not link:
            continue
        gefunden.append({
            "titel": titel,
            "link": link,
            "quelle": quelle,
            "zeit": zeitstempel(eintrag),
        })
    return gefunden


def main() -> int:
    alle: list[dict] = []
    for quelle, url in QUELLEN:
        print(f"Hole {quelle} …")
        rohdaten = hole(url)
        if rohdaten is None:
            continue
        neue = meldungen_aus(quelle, rohdaten)
        print(f"  {len(neue)} Meldungen")
        alle.extend(neue)

    if not alle:
        # Lieber den alten Stand behalten als eine leere Datei schreiben.
        print("Keine Meldungen erhalten, Datei bleibt unverändert.", file=sys.stderr)
        return 1

    # Neueste zuerst; Meldungen ohne Datum nach hinten.
    alle.sort(key=lambda m: m["zeit"] or "", reverse=True)

    gesehen = set()
    auswahl = []
    for meldung in alle:
        if meldung["titel"] in gesehen:
            continue
        gesehen.add(meldung["titel"])
        auswahl.append(meldung)
        if len(auswahl) == ANZAHL:
            break

    ZIEL.parent.mkdir(parents=True, exist_ok=True)
    ZIEL.write_text(
        json.dumps(
            {
                "stand": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "meldungen": auswahl,
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )
    print(f"{len(auswahl)} Meldungen nach {ZIEL.name} geschrieben.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
