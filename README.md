# Disciplin

Eine installierbare Web-App (PWA) für TMS-Vorbereitung, Gym-Progress, Habits/To-Dos und einen
zentralen Kalender — schwarz-weißes Design, farbige Diagramme, alles bearbeitbar über die
Einstellungen. Läuft ohne Build-Schritt: einfach die Datei `index.html` über einen Webserver
ausliefern (nicht `file://` öffnen — ES-Module und der Service Worker brauchen `http(s)://`).

## Installation auf dem iPhone

1. Die App muss über eine echte URL erreichbar sein (siehe „Hosting" unten) — `Add to Home Screen`
   funktioniert nicht von `localhost` auf dem Mac, das iPhone braucht eine eigene URL.
2. Die URL in **Safari** öffnen (nicht Chrome — „Zum Home-Bildschirm" gibt es auf iOS nur in Safari).
3. Teilen-Symbol → **Zum Home-Bildschirm** → Hinzufügen.
4. Auf jedem weiteren iPhone wiederholen. Die App läuft danach im Vollbild wie eine native App.

## Hosting

Am einfachsten: **GitHub Pages** (kostenlos, HTTPS, passt zu diesem Repo). Sobald aktiviert, ist die
App unter `https://<username>.github.io/<repo>/Disciplin/` erreichbar.

## Geräte-Sync (optional)

Ohne weitere Einrichtung läuft die App lokal auf jedem Gerät für sich (`localStorage`). Für echten
Sync über mehrere iPhones hinweg:

1. Kostenlosen Account auf [supabase.com](https://supabase.com) anlegen → neues Projekt.
2. Im SQL Editor das mitgelieferte [`supabase/schema.sql`](supabase/schema.sql) ausführen.
3. Project URL & Anon Public Key (Project Settings → API) in der App unter
   **Einstellungen → Geräte-Synchronisierung** eintragen.
4. Auf jedem Gerät mit derselben E-Mail per Magic Link anmelden — Daten laufen dann automatisch zusammen.

## Google Kalender (optional)

Liest den Google Kalender direkt im Browser mit (nur lesend, kein eigener Server nötig):

1. [console.cloud.google.com](https://console.cloud.google.com) → Projekt anlegen.
2. „APIs & Dienste" → Anmeldedaten → OAuth-Client-ID → Typ **Webanwendung**.
3. Als autorisierten JavaScript-Origin die gehostete App-URL eintragen (z. B.
   `https://<username>.github.io`).
4. Client-ID in **Einstellungen → Kalender** eintragen und „Verbinden" tippen.

Einschränkung: Es gibt keinen eigenen Server für Push-Benachrichtigungen von Google — die App holt
neue Termine ab, sobald sie geöffnet/in den Vordergrund geholt wird, nicht in Echtzeit.

## Projektstruktur

```
Disciplin/
  index.html            App-Shell
  manifest.webmanifest   PWA-Manifest (Icon, Name, Vollbild)
  service-worker.js      Offline-Caching
  css/styles.css         Design-System (Dark, Farbpalette)
  js/                    App-Logik (ein Modul pro Screen + store/sync/charts)
  vendor/                Chart.js & Supabase JS (lokal eingebunden, kein CDN nötig)
  supabase/schema.sql     Datenbank-Schema für den optionalen Sync
```

## TMS-Baseline

Die eigene Baseline (Gesamtwert, Prozentrang und Werte je Untertest aus dem offiziellen
Testbericht) wird beim ersten Öffnen der TMS-Sektion direkt in der App eingetragen und über
„Bearbeiten" jederzeit angepasst. Sie wird nur lokal bzw. im eigenen privaten Supabase-Projekt
gespeichert — nie im Code oder Repo. Zielwert in der App: **93**.
