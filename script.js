/*
 * Inschrijvingen versturen.
 *
 * Optie 1 (aanbevolen): maak een gratis formulier aan op https://formspree.io,
 * kopieer de endpoint-URL en plak die hieronder in FORM_ENDPOINT.
 * Inschrijvingen komen dan als e-mail bij je binnen.
 *
 * Optie 2: laat FORM_ENDPOINT leeg. Het formulier opent dan een e-mail in het
 * mailprogramma van de bezoeker, gericht aan CONTACT_EMAIL, met alle gegevens
 * alvast ingevuld.
 */
const FORM_ENDPOINT = "";
const CONTACT_EMAIL = "jouw@emailadres.nl";

const form = document.getElementById("signup-form");
const errorBox = document.getElementById("form-error");
const successBox = document.getElementById("form-success");
const submitBtn = document.getElementById("submit-btn");

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

function collectData() {
  const fd = new FormData(form);
  return {
    naam: (fd.get("naam") || "").trim(),
    email: (fd.get("email") || "").trim(),
    telefoon: (fd.get("telefoon") || "").trim(),
    woonplaats: (fd.get("woonplaats") || "").trim(),
    drank: fd.get("drank") || "",
    beschikbaar: fd.getAll("beschikbaar").join(", "),
    over: (fd.get("over") || "").trim(),
    akkoord: fd.get("akkoord") === "on",
    website: (fd.get("website") || "").trim()
  };
}

function validate(data) {
  form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));

  if (!data.naam) {
    form.naam.classList.add("invalid");
    form.naam.focus();
    return "Vul je naam in, dan weet ik wie ik mag verwachten.";
  }
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    form.email.classList.add("invalid");
    form.email.focus();
    return "Vul een geldig e-mailadres in, anders kan ik je niet bereiken.";
  }
  if (!data.akkoord) {
    form.akkoord.focus();
    return "Vink aan dat je 18 jaar of ouder bent en akkoord gaat.";
  }
  return null;
}

function buildMessage(data) {
  return [
    `Naam: ${data.naam}`,
    `E-mail: ${data.email}`,
    `Telefoon: ${data.telefoon || "-"}`,
    `Woonplaats: ${data.woonplaats || "-"}`,
    `Drinkt het liefst: ${data.drank}`,
    `Beschikbaar: ${data.beschikbaar || "-"}`,
    "",
    "Over mij:",
    data.over || "-"
  ].join("\n");
}

async function sendViaEndpoint(data) {
  const response = await fetch(FORM_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      naam: data.naam,
      email: data.email,
      telefoon: data.telefoon,
      woonplaats: data.woonplaats,
      drank: data.drank,
      beschikbaar: data.beschikbaar,
      over: data.over,
      _subject: `Wijn met mij: inschrijving van ${data.naam}`
    })
  });
  if (!response.ok) {
    throw new Error(`Versturen mislukt (status ${response.status})`);
  }
}

function sendViaMail(data) {
  const subject = encodeURIComponent(`Wijn met mij: inschrijving van ${data.naam}`);
  const body = encodeURIComponent(buildMessage(data));
  window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}

function showSuccess() {
  form.hidden = true;
  successBox.hidden = false;
  successBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();

  const data = collectData();

  // Honeypot ingevuld: waarschijnlijk een bot. Doe alsof het gelukt is.
  if (data.website) {
    showSuccess();
    return;
  }

  const problem = validate(data);
  if (problem) {
    showError(problem);
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Bezig met versturen...";

  try {
    if (FORM_ENDPOINT) {
      await sendViaEndpoint(data);
    } else {
      sendViaMail(data);
    }
    showSuccess();
  } catch (err) {
    console.error(err);
    showError(
      `Het versturen is helaas niet gelukt. Probeer het later nog eens of mail me direct op ${CONTACT_EMAIL}.`
    );
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Verstuur mijn inschrijving";
  }
});
