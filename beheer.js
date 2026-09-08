/*
 * Beheerpagina: instellingen invullen, live bekijken en opslaan.
 *
 * Opslaan gebeurt door config.js in de GitHub-repository bij te werken via de
 * GitHub API. Daarvoor is een fine-grained personal access token nodig met
 * alleen "Contents: read and write" op deze repository. De sleutel blijft in
 * de browser van de beheerder en gaat nergens anders heen dan naar GitHub.
 */
(function () {
  "use strict";

  const form = document.getElementById("beheer-form");
  const errorBox = document.getElementById("beheer-error");
  const okBox = document.getElementById("beheer-ok");
  const saveBtn = document.getElementById("save-btn");
  const downloadBtn = document.getElementById("download-btn");
  const preview = document.getElementById("preview");
  const previewOpen = document.getElementById("preview-open");
  const githubDetails = document.getElementById("github-details");
  const STORAGE_KEY = "wijn-met-mij-beheer";

  /* ---------- Hulpfuncties ---------- */

  function toBase64(text) {
    return btoa(unescape(encodeURIComponent(text)));
  }

  function encodeConfig(cfg) {
    return toBase64(JSON.stringify(cfg)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function configFile(cfg) {
    return [
      "/*",
      " * Instellingen van deze Wijn met mij-site.",
      " * Aanpassen kan via beheer.html of gewoon hier in het bestand.",
      " */",
      "window.SITE_CONFIG = " + JSON.stringify(cfg, null, 2) + ";",
      ""
    ].join("\n");
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

  function showError(msg) {
    okBox.hidden = true;
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }

  function showOk(msg) {
    errorBox.hidden = true;
    okBox.textContent = msg;
    okBox.hidden = false;
  }

  /* ---------- Voorbeeld ---------- */

  let previewTimer = null;
  function updatePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      const hash = "#c=" + encodeConfig(collect());
      previewOpen.href = "index.html" + hash;
      // Een adres dat alleen achter het hekje verschilt laadt het frame niet
      // opnieuw; een wisselende parameter ervoor wel.
      preview.src = "index.html?v=" + Date.now() + hash;
    }, 300);
  }

  /* ---------- Vooraf invullen ---------- */

  function detectRepo() {
    const host = window.location.hostname;
    const m = host.match(/^([^.]+)\.github\.io$/i);
    if (!m) return {};
    const owner = m[1];
    const seg = window.location.pathname.split("/").filter(Boolean);
    const repo = seg.length > 1 || (seg.length === 1 && !seg[0].endsWith(".html")) ? seg[0] : `${owner}.github.io`;
    return { owner, repo };
  }

  function prefill() {
    const cfg = Object.assign({ naam: "", plaats: "", email: "", waarom: "" }, window.SITE_CONFIG || {});
    form.naam.value = cfg.naam;
    form.plaats.value = cfg.plaats;
    form.email.value = cfg.email;
    form.waarom.value = cfg.waarom;

    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (e) {
      saved = {};
    }
    const detected = detectRepo();
    form.owner.value = saved.owner || detected.owner || "";
    form.repo.value = saved.repo || detected.repo || "";
    form.branch.value = saved.branch || "main";
    if (saved.token) {
      form.token.value = saved.token;
      form.querySelector("#b-onthoud").checked = true;
    }
    if (!form.token.value) githubDetails.open = true;
    updatePreview();
  }

  function rememberGithub() {
    const remember = form.querySelector("#b-onthoud").checked;
    const data = {
      owner: form.owner.value.trim(),
      repo: form.repo.value.trim(),
      branch: form.branch.value.trim() || "main",
      token: remember ? form.token.value.trim() : ""
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      /* opslag niet beschikbaar; geen probleem */
    }
  }

  /* ---------- Opslaan via GitHub ---------- */

  async function githubRequest(method, url, token, body) {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    let payload = {};
    try {
      payload = await response.json();
    } catch (e) {
      payload = {};
    }
    return { ok: response.ok, status: response.status, payload };
  }

  async function saveToGithub(cfg) {
    const owner = form.owner.value.trim();
    const repo = form.repo.value.trim();
    const branch = form.branch.value.trim() || "main";
    const token = form.token.value.trim();

    if (!owner || !repo) {
      githubDetails.open = true;
      throw new Error("Vul de eigenaar en de naam van de repository in onder GitHub-koppeling.");
    }
    if (!token) {
      githubDetails.open = true;
      throw new Error("Vul een toegangssleutel in onder GitHub-koppeling; zonder sleutel kan ik niets opslaan.");
    }

    const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/config.js`;

    const current = await githubRequest("GET", `${base}?ref=${encodeURIComponent(branch)}`, token);
    if (current.status === 401) throw new Error("De toegangssleutel wordt niet geaccepteerd. Controleer of je hem goed hebt overgenomen.");
    if (current.status === 403) throw new Error("Geen toegang tot deze repository. Controleer of de sleutel toegang heeft tot precies deze repository, met Contents op Read and write.");
    if (!current.ok && current.status !== 404) throw new Error(`GitHub gaf een fout (${current.status}): ${current.payload.message || "onbekend"}`);

    const body = {
      message: "Instellingen bijgewerkt via beheerpagina",
      content: toBase64(configFile(cfg)),
      branch
    };
    if (current.ok && current.payload.sha) body.sha = current.payload.sha;

    const result = await githubRequest("PUT", base, token, body);
    if (!result.ok) {
      throw new Error(`Opslaan mislukt (${result.status}): ${result.payload.message || "onbekend"}`);
    }
  }

  /* ---------- Gebeurtenissen ---------- */

  form.addEventListener("input", (event) => {
    if (["naam", "plaats", "email", "waarom"].includes(event.target.name)) updatePreview();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.hidden = true;
    okBox.hidden = true;

    const cfg = collect();
    if (!cfg.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.email)) {
      form.email.focus();
      showError("Vul een geldig e-mailadres in; daar komen de inschrijvingen binnen.");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Bezig met opslaan...";
    try {
      await saveToGithub(cfg);
      rememberGithub();
      showOk("Opgeslagen. GitHub Pages zet de nieuwe instellingen meestal binnen een minuut live; ververs de site daarna even.");
    } catch (err) {
      console.error(err);
      showError(err.message || "Opslaan is niet gelukt.");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Opslaan op de site";
    }
  });

  downloadBtn.addEventListener("click", () => {
    const blob = new Blob([configFile(collect())], { type: "text/javascript" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "config.js";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  prefill();
})();
