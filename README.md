# Wijn met mij

Een eenvoudige website waar mensen zich kunnen inschrijven om samen een fles wijn te drinken en elkaar te leren kennen. Ik betaal, er zijn geen verplichtingen; ik ben gewoon nieuwsgierig naar andere mensen.

## Wat zit erin

- `index.html`: de pagina zelf (uitnodiging, spelregels, inschrijfformulier, veelgestelde vragen)
- `style.css`: de vormgeving
- `script.js`: het versturen van inschrijvingen

Geen bouwstap, geen afhankelijkheden. Open `index.html` in een browser en het werkt.

## Inschrijvingen ontvangen

Bovenaan `script.js` staan twee instellingen:

```js
const FORM_ENDPOINT = "";
const CONTACT_EMAIL = "jouw@emailadres.nl";
```

**Aanbevolen: Formspree.** Maak een gratis account op [formspree.io](https://formspree.io), maak een nieuw formulier aan en kopieer de endpoint-URL (iets als `https://formspree.io/f/abcdwxyz`). Plak die in `FORM_ENDPOINT`. Elke inschrijving komt dan netjes als e-mail binnen, zonder dat de bezoeker zijn mailprogramma nodig heeft.

**Zonder endpoint.** Laat `FORM_ENDPOINT` leeg. Het formulier opent dan het mailprogramma van de bezoeker met alle gegevens alvast ingevuld, gericht aan `CONTACT_EMAIL` (vul daar je eigen adres in). Werkt altijd, maar is iets minder soepel voor de bezoeker.

## Online zetten met GitHub Pages

1. Ga in de repository naar **Settings** en dan **Pages**.
2. Kies bij *Build and deployment* voor **Deploy from a branch**.
3. Kies de branch `main` en de map `/ (root)`, en klik op *Save*.
4. Na een minuut staat de site op `https://<gebruikersnaam>.github.io/wijn-met-mij/`.

Een eigen domeinnaam koppelen kan op dezelfde pagina onder *Custom domain*.

## Aanpassen

- Teksten staan allemaal in `index.html`; pas ze gerust aan naar je eigen toon.
- Kleuren staan bovenaan `style.css` in de `:root`-variabelen.
- Formuliervelden toevoegen? Voeg een veld toe in `index.html` en neem het mee in `collectData` en `buildMessage` in `script.js`.
