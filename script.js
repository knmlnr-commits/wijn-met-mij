/*
 * Wijn met mij: laden van de instellingen en versturen van inschrijvingen.
 *
 * De instellingen komen uit config.js (window.SITE_CONFIG). Staat er een
 * #c=... in de adresbalk, dan overschrijft die de instellingen; zo kan een
 * link uit start.html direct een gepersonaliseerde site tonen.
 *
 * Inschrijvingen gaan via FormSubmit (formsubmit.co) rechtstreeks naar het
 * e-mailadres uit de instellingen. Daar is geen account voor nodig; bij de
 * eerste inschrijving stuurt FormSubmit een activatiemail naar dat adres.
 * Lukt het versturen niet, dan opent het mailprogramma van de bezoeker als
 * terugvaloptie.
 */
(function () {
  "use strict";

  /* ---------- Instellingen ---------- */

  const DEFAULTS = { naam: "", plaats: "", email: "", waarom: "" };

  function decodeConfig(encoded) {
    try {
      const json = decodeURIComponent(escape(atob(encoded.replace(/-/g, "+").replace(/_/g, "/"))));
      const parsed = JSON.parse(json);
      return typeof parsed === "object" && parsed ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function loadConfig() {
    const base = Object.assign({}, DEFAULTS, window.SITE_CONFIG || {});
    const match = window.location.hash.match(/[#&]c=([^&]+)/);
    if (match) {
      Object.assign(base, decodeConfig(match[1]));
    }
    Object.keys(base).forEach((k) => {
      base[k] = String(base[k] || "").trim();
    });
    return base;
  }

  const cfg = loadConfig();

  /* ---------- Pagina personaliseren ---------- */

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el && text) el.textContent = text;
  }

  function render() {
    if (cfg.naam) {
      document.title = `Wijn met ${cfg.naam}`;
      setText("eyebrow", cfg.plaats ? `Een open uitnodiging van ${cfg.naam} uit ${cfg.plaats}` : `Een open uitnodiging van ${cfg.naam}`);
      setText("footer-tekst", `Wijn met mij. Een persoonlijk initiatief van ${cfg.naam}, zonder bijbedoelingen. Proost.`);
    } else if (cfg.plaats) {
      setText("eyebrow", `Een open uitnodiging in ${cfg.plaats}`);
    }

    if (cfg.plaats) {
      setText("stap3-tekst", `Ergens in een café, wijnbar of restaurant in of rond ${cfg.plaats}. Een fles wijn op tafel, en verder zien we wel waar het gesprek heen gaat.`);
      setText("faq-waar", `Op een openbare plek in of rond ${cfg.plaats}, zoals een café, wijnbar of restaurant. We kiezen samen iets dat voor ons allebei goed bereikbaar is.`);
    }

    if (cfg.waarom) {
      const box = document.getElementById("waarom-tekst");
      box.innerHTML = "";
      cfg.waarom.split(/\n\s*\n/).forEach((alinea) => {
        const p = document.createElement("p");
        p.textContent = alinea.trim();
        box.appendChild(p);
      });
    }
  }

  render();

  /* ---------- Formulier ---------- */

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

  function subject(data) {
    return `Wijn met mij: inschrijving van ${data.naam}`;
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

  async function sendViaFormSubmit(data) {
    const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(cfg.email)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        Naam: data.naam,
        "E-mail": data.email,
        Telefoon: data.telefoon || "-",
        Woonplaats: data.woonplaats || "-",
        "Drinkt het liefst": data.drank,
        Beschikbaar: data.beschikbaar || "-",
        "Over mij": data.over || "-",
        _subject: subject(data),
        _replyto: data.email,
        _template: "table",
        _captcha: "false"
      })
    });
    if (!response.ok) {
      throw new Error(`Versturen mislukt (status ${response.status})`);
    }
    const result = await response.json().catch(() => ({}));
    if (String(result.success) === "false") {
      throw new Error(result.message || "FormSubmit weigerde het bericht");
    }
  }

  function sendViaMail(data) {
    const s = encodeURIComponent(subject(data));
    const body = encodeURIComponent(buildMessage(data));
    window.location.href = `mailto:${cfg.email}?subject=${s}&body=${body}`;
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

    if (!cfg.email) {
      showError("Deze site heeft nog geen e-mailadres ingesteld. Vul dat in via config.js of start.html.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Bezig met versturen...";

    try {
      await sendViaFormSubmit(data);
      showSuccess();
    } catch (err) {
      console.error(err);
      // Terugvaloptie: open het mailprogramma van de bezoeker.
      sendViaMail(data);
      showSuccess();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Verstuur mijn inschrijving";
    }
  });
})();
