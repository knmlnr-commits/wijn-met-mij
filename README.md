# Wijn met mij

Een open uitnodiging voor een leuke avond: mensen schrijven zich in om samen een fles wijn te drinken en elkaar te leren kennen. Geen agenda, geen verwachtingen.

De site is zo gebouwd dat iedereen er in een minuut een eigen versie van kan maken.

## Wat zit erin

| Bestand | Doel |
| --- | --- |
| `index.html` | De uitnodiging zelf, met inschrijfformulier en veelgestelde vragen |
| `start.html` + `start.js` | Startpagina: vul je gegevens in en krijg je eigen Wijn met mij |
| `config.js` | Instellingen van deze site (naam, plaats, e-mailadres, eigen tekst) |
| `script.js` | Personaliseert de pagina en verstuurt inschrijvingen |
| `style.css` | Vormgeving |
| `zip.js` | Kleine ZIP-schrijver voor de download op de startpagina |

Geen bouwstap, geen afhankelijkheden. Open `index.html` in een browser en het werkt.

## Inschrijvingen ontvangen

Inschrijvingen gaan via [FormSubmit](https://formsubmit.co) rechtstreeks naar het e-mailadres in `config.js`. Daar hoef je geen account voor aan te maken. Bij de eerste inschrijving stuurt FormSubmit een activatiemail naar dat adres; bevestig die één keer en daarna komen alle berichten gewoon binnen.

Lukt het versturen onverhoopt niet, dan opent het mailprogramma van de bezoeker met alle gegevens alvast ingevuld.

## Je eigen Wijn met mij starten

Ga naar `start.html`, vul je voornaam, stad, e-mailadres en eventueel een eigen tekst in. Je krijgt dan:

1. **Een link.** Je gegevens zitten in de link zelf (achter het hekje), dus er wordt niets op een server opgeslagen. De link werkt direct en kun je meteen delen.
2. **Een ZIP-bestand.** Alle bestanden met jouw gegevens al ingevuld in `config.js`. Zet de inhoud op een webhost naar keuze en je site draait los van deze.

Handmatig aanpassen kan ook: verander de waarden in `config.js`.

## Online zetten met GitHub Pages

1. Ga in de repository naar **Settings** en dan **Pages**.
2. Kies bij *Build and deployment* voor **Deploy from a branch**.
3. Kies de branch `main` en de map `/ (root)`, en klik op *Save*.
4. Na een minuut staat de site op `https://<gebruikersnaam>.github.io/wijn-met-mij/`.

Een eigen domeinnaam koppelen kan op dezelfde pagina onder *Custom domain*.

## Aanpassen

- Teksten staan in `index.html`; pas ze gerust aan naar je eigen toon.
- Kleuren staan bovenaan `style.css` in de `:root`-variabelen.
- Formuliervelden toevoegen? Voeg een veld toe in `index.html` en neem het mee in `collectData`, `sendViaFormSubmit` en `buildMessage` in `script.js`.
