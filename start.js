/*
 * Start je eigen Wijn met mij: bouwt een gepersonaliseerde link en een
 * downloadbaar pakketje op basis van de ingevulde gegevens.
 */
(function () {
  "use strict";

  const form = document.getElementById("start-form");
  const errorBox = document.getElementById("start-error");
  const result = document.getElementById("start-result");
  const linkField = document.getElementById("site-link");
  const previewLink = document.getElementById("preview-link");
  const copyBtn = document.getElementById("copy-btn");
  const copyHint = document.getElementById("copy-hint");
  const zipBtn = document.getElementById("zip-btn");
  const editBtn = document.getElementById("edit-btn");

  let current = null;

  function encodeConfig(cfg) {
    const json = JSON.stringify(cfg);
    return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function collect() {
    const fd = new FormData(form);
    return {
      naam: (fd.get("naam") || "").trim(),
      plaats: (fd.get("plaats") || "").trim(),
      email: (fd.get("email") || "").trim(),
      waarom: (fd.get("waarom") || "").trim()
    };
  }

  function validate(cfg) {
    form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
    if (!cfg.naam) {
      form.naam.classList.add("invalid");
      form.naam.focus();
      return "Vul je voornaam in.";
    }
    if (!cfg.plaats) {
      form.plaats.classList.add("invalid");
      form.plaats.focus();
      return "Vul je stad of regio in.";
    }
    if (!cfg.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.email)) {
      form.email.classList.add("invalid");
      form.email.focus();
      return "Vul een geldig e-mailadres in; daar komen de inschrijvingen binnen.";
    }
    return null;
  }

  function siteUrl(cfg) {
    const base = new URL("index.html", window.location.href);
    base.hash = "c=" + encodeConfig(cfg);
    return base.toString();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    errorBox.hidden = true;

    const cfg = collect();
    const problem = validate(cfg);
    if (problem) {
      errorBox.textContent = problem;
      errorBox.hidden = false;
      return;
    }

    current = cfg;
    const url = siteUrl(cfg);
    linkField.value = url;
    previewLink.href = url;
    copyHint.hidden = true;

    form.hidden = true;
    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  editBtn.addEventListener("click", () => {
    result.hidden = true;
    form.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(linkField.value);
    } catch (e) {
      linkField.select();
      document.execCommand("copy");
    }
    copyHint.hidden = false;
  });

  function configFile(cfg) {
    return [
      "/* Instellingen van deze Wijn met mij-site. Pas gerust aan. */",
      "window.SITE_CONFIG = " + JSON.stringify(cfg, null, 2) + ";",
      ""
    ].join("\n");
  }

  async function fetchText(name) {
    const response = await fetch(name, { cache: "no-store" });
    if (!response.ok) throw new Error(`Kon ${name} niet ophalen`);
    return response.text();
  }

  zipBtn.addEventListener("click", async () => {
    if (!current) return;
    zipBtn.disabled = true;
    zipBtn.textContent = "Bezig met inpakken...";
    try {
      const map = "wijn-met-mij/";
      const bestanden = ["index.html", "style.css", "script.js", "start.html", "start.js", "zip.js", "beheer.html", "beheer.js", "README.md"];
      const files = [];
      for (const naam of bestanden) {
        files.push({ name: map + naam, text: await fetchText(naam) });
      }
      files.push({ name: map + "config.js", text: configFile(current) });
      files.push({ name: map + ".nojekyll", text: "" });
      const blob = makeZip(files);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "wijn-met-mij.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (err) {
      console.error(err);
      alert("Het inpakken is niet gelukt. Gebruik in de tussentijd gewoon de link.");
    } finally {
      zipBtn.disabled = false;
      zipBtn.textContent = "Download als ZIP";
    }
  });
})();
