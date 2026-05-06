# AInauten Privacy Filter

Browser-basierte Datenschutz-App zum Maskieren sensibler Daten vor dem Einfügen in AI-Tools.

## Features

- **Maskierung sensibler Daten** per Mustererkennung (E-Mail, Telefon, IBAN, Kreditkarte, SSN, IPv4)
- **Beispiel-Daten** mit einem Klick laden
- **Export** des maskierten Ergebnisses als JSON oder TXT
- **Klare Grenzen** transparent dokumentiert
- **Landingpage im AInauten-Look** (Dark Space Style)

## Start

Da es sich um eine statische App handelt, genügt es `index.html` im Browser zu öffnen.

Optional per lokalem Webserver:

```bash
python3 -m http.server 8080
```

Danach: `http://localhost:8080`

## Deployment auf `privacy.ainauten.com`

1. Repository nach `github.com/openai/privacy-filter` pushen.
2. Auf Vercel/Netlify/Cloudflare Pages als static site deployen.
3. DNS-CNAME für `privacy.ainauten.com` auf die Deploy-Zieldomain setzen.
4. HTTPS aktivieren.

## Hinweis

Diese MVP-Version arbeitet vollständig im Browser (kein Server-Upload), bietet aber **keine 100%-Garantie**. Vor dem Teilen immer manuell prüfen.
