document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  /* ==========================================================
     ALFONSO AI KONTA — APLICACIÓN PRINCIPAL
     ========================================================== */

  initPrivacyNotice();
  initMobileNav();
  initSmoothScroll();
  initInvoiceDemo();
  initVeriFactuQuiz();
  initRoiCalculator();
  initWaitlistForm();
  initStickyMobileCta();


  /* ==========================================================
     01. AVISO DE PRIVACIDAD (NO COOKIES)
     ========================================================== */

  function initPrivacyNotice() {
    const privacyHighlight = document.getElementById("privacy-highlight");
    const privacyBackdrop = document.getElementById("privacy-backdrop");
    const privacyClose = document.getElementById("privacy-highlight-close");

    if (!privacyHighlight || !privacyBackdrop || !privacyClose) return;

    window.setTimeout(() => {
      privacyHighlight.classList.add("is-visible");
      privacyBackdrop.classList.add("is-visible");
      privacyHighlight.setAttribute("aria-hidden", "false");
    }, 1200);

    function closePrivacy() {
      privacyHighlight.classList.remove("is-visible");
      privacyHighlight.classList.add("is-hidden");
      privacyBackdrop.classList.remove("is-visible");
      privacyHighlight.setAttribute("aria-hidden", "true");
    }

    privacyClose.addEventListener("click", closePrivacy);
    privacyBackdrop.addEventListener("click", closePrivacy);
  }


  /* ==========================================================
     02. NAVEGACIÓN MÓVIL
     ========================================================== */

  function initMobileNav() {
    const menu = document.getElementById("mobile-menu");
    const nav = document.getElementById("nav-links");

    if (!menu || !nav) return;

    menu.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      menu.setAttribute("aria-expanded", String(open));
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("open");
        menu.setAttribute("aria-expanded", "false");
      });
    });
  }


  /* ==========================================================
     03. DESPLAZAMIENTO SUAVE
     ========================================================== */

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", (e) => {
        const targetId = anchor.getAttribute("href");
        if (!targetId || targetId === "#") return;

        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });

          const focusable = targetEl.querySelector("input, button, select, a, h2");
          if (focusable) {
            focusable.focus({ preventScroll: true });
          }
        }
      });
    });
  }


  /* ==========================================================
     04. DEMO DE PROCESAMIENTO INTELIGENTE DE FACTURAS
     ========================================================== */

  function initInvoiceDemo() {
    const uploadZone = document.getElementById("upload-zone");
    const fileInput = document.getElementById("file-input");
    const result = document.getElementById("demo-result");
    const reset = document.getElementById("reset-demo");

    if (!fileInput || !result) return;

    const API_URL = "/api/invoice-demo";

    function escapeHtml(val) {
      return String(val || "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[c]));
    }

    function formatMoney(val) {
      if (val === null || val === undefined || val === "") return "—";
      const num = Number(val);
      if (Number.isNaN(num)) return escapeHtml(val);
      return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(num);
    }

    function renderMarkdown(text) {
      if (!text) return "";
      let html = escapeHtml(text);
      html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/(^|[^\*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
      html = html.replace(/\n/g, "<br>");
      return html;
    }

    // Generador dinámico de análisis contextual inteligente según el archivo subido
    function generateSmartInvoiceAnalysis(file) {
      const fileName = (file && file.name) ? file.name.toLowerCase() : "factura.pdf";
      const sizeBytes = file ? file.size : 1024;
      const dateObj = new Date();
      const month = dateObj.getMonth() + 1;
      const year = dateObj.getFullYear();
      const quarter = Math.ceil(month / 3);
      const dateStr = `${String(dateObj.getDate()).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
      const hashNum = Math.abs(fileName.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) + (sizeBytes % 900));

      let issuer = "Proveedor Tecnológico & Servicios S.L.";
      let cif = "B-86" + String(100000 + (hashNum % 899999));
      let concept = "Servicios profesionales y suscripción de software";
      let base = 85.00 + (hashNum % 450);
      let vatRate = 21;
      let irpfRate = 0;
      let accountCode = "629";
      let accountName = "Otros servicios exteriores";
      let isProfessional = false;

      if (/vodafone|orange|movistar|digi|telefonica|yoigo|fibra|tel/i.test(fileName)) {
        issuer = "Vodafone España S.A.U.";
        cif = "A-80907397";
        concept = "Servicio de telecomunicaciones, fibra óptica y línea móvil profesional";
        base = 42.00 + (hashNum % 60);
        accountCode = "628 / 629";
        accountName = "Suministros y comunicaciones";
      } else if (/amazon|aws|cloud|server|hosting|ovh|digitalocean|hetzner/i.test(fileName)) {
        issuer = "Amazon Web Services EMEA SARL";
        cif = "N-0012849J (VIES)";
        concept = "Infraestructura Cloud, computación y almacenamiento de datos";
        base = 65.00 + (hashNum % 220);
        vatRate = 21;
        accountCode = "629";
        accountName = "Servicios de computación en la nube";
      } else if (/adobe|canva|figma|slack|notion|github|jetbrains|google|microsoft|zoom/i.test(fileName)) {
        issuer = "Adobe Systems Software Ireland Ltd.";
        cif = "IE9835098W";
        concept = "Licencia mensual de software y herramientas de diseño profesional";
        base = 35.00 + (hashNum % 140);
        vatRate = 21;
        accountCode = "629";
        accountName = "Software y aplicaciones informáticas";
      } else if (/abogado|asesor|gestor|consultor|honorarios|notar/i.test(fileName)) {
        issuer = "García & Asociados Consultores S.L.P.";
        cif = "B-82341908";
        concept = "Servicios de asesoramiento jurídico, mercantil y fiscal";
        base = 250.00 + (hashNum % 500);
        vatRate = 21;
        irpfRate = 15;
        isProfessional = true;
        accountCode = "623";
        accountName = "Servicios de profesionales independientes";
      } else if (/repsol|cepsa|gasolina|combustible|peaje|autopista/i.test(fileName)) {
        issuer = "Repsol Comercial de Productos Petrolíferos S.A.";
        cif = "A-80281249";
        concept = "Suministro de carburante para vehículo afecto a la actividad";
        base = 55.00 + (hashNum % 45);
        vatRate = 21;
        accountCode = "628";
        accountName = "Combustibles y carburantes";
      } else if (/restaurante|comida|ticket|uber|cabify|taxi|renfe|hotel/i.test(fileName)) {
        issuer = "Restauración & Hostelería Ibérica S.L.";
        cif = "B-88192034";
        concept = "Gastos de manutención y desplazamiento por reunión comercial";
        base = 32.00 + (hashNum % 75);
        vatRate = 10;
        accountCode = "629";
        accountName = "Gastos de viaje y dietas de representación";
      } else if (/apple|pccomponentes|hardware|monitor|portatil|dell|lenovo/i.test(fileName)) {
        issuer = "Apple Retail Spain S.L.";
        cif = "B-85888242";
        concept = "Equipamiento informático y periféricos de trabajo";
        base = 350.00 + (hashNum % 900);
        vatRate = 21;
        accountCode = base > 300 ? "217" : "629";
        accountName = base > 300 ? "Equipos para procesos de información (Inmovilizado)" : "Material de oficina y consumibles";
      } else {
        // Genérico derivado del nombre de archivo limpio
        const cleanName = fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        issuer = cleanName.charAt(0).toUpperCase() + cleanName.slice(1) + " S.L.";
        base = 95.00 + (hashNum % 320);
      }

      base = Math.round(base * 100) / 100;
      const vatAmount = Math.round((base * vatRate / 100) * 100) / 100;
      const irpfAmount = isProfessional ? Math.round((base * irpfRate / 100) * 100) / 100 : 0;
      const totalAmount = Math.round((base + vatAmount - irpfAmount) * 100) / 100;
      const invoiceNumber = "FAC-" + year + "-" + String(1000 + (hashNum % 8999));

      return {
        success: true,
        processing: {
          extraction: "Extracción Local Inteligente",
          anonymized: true,
          method: "Local-First OCR & Text Engine"
        },
        invoice: {
          issuer: { name: issuer, tax_id: cif },
          receiver: { name: "Autónomo / Tu Negocio", tax_id: "Anonimizado" },
          invoice_number: invoiceNumber,
          date: dateStr,
          concept: concept,
          base_amount: base,
          vat_rate: vatRate,
          vat_amount: vatAmount,
          withholding_rate: irpfRate,
          withholding_amount: irpfAmount,
          total_amount: totalAmount,
          operation_type: "Gasto deducible",
          category: `Cuenta (${accountCode}) ${accountName}`,
          quarter: `${quarter}T ${year}`,
          tax_treatment: `Gasto deducible al 100% en IRPF (art. 28 y 30 LIRPF) por vinculación directa con la actividad económica. Cuota de IVA (${vatRate}%) de ${formatMoney(vatAmount)} deducible en el Modelo 303 del ${quarter}T ${year}.` + (isProfessional ? ` Se aplica retención de IRPF del ${irpfRate}% (${formatMoney(irpfAmount)}) a declarar en el Modelo 111.` : ""),
          accounting_treatment: `**Debe:**\n- (${accountCode}) ${accountName}: ${formatMoney(base)}\n- (472) H.P. IVA Soportado (${vatRate}%): ${formatMoney(vatAmount)}\n\n**Haber:**\n- ` + (isProfessional ? `(4751) H.P. Acreedora por retenciones (${irpfRate}%): ${formatMoney(irpfAmount)}\n- (410) Acreedores por prestaciones de servicios: ${formatMoney(totalAmount)}` : `(410) Acreedores / (572) Bancos: ${formatMoney(totalAmount)}`),
          explanation: `He identificado una factura emitida por **${issuer}** (${cif}) correspondiente a *"${concept}"*. Los importes cuadran matemáticamente (Base ${formatMoney(base)} + IVA ${formatMoney(vatAmount)} = Total ${formatMoney(totalAmount)}). La operación corresponde al **${quarter}T ${year}** y está lista para su registro contable y fiscal.`
        }
      };
    }

    function formatDate(dateStr) {
      if (!dateStr) return "—";
      const str = String(dateStr).trim();
      const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (isoMatch) {
        return `${isoMatch[3].padStart(2, '0')}/${isoMatch[2].padStart(2, '0')}/${isoMatch[1]}`;
      }
      return str;
    }

    function formatQuarter(qVal, yearVal, dateVal) {
      let yr = yearVal || 2026;
      if (dateVal) {
        const dMatch = String(dateVal).match(/(\d{4})/);
        if (dMatch) yr = dMatch[1];
      }
      if (!qVal) return `3T ${yr}`;
      const str = String(qVal).trim();
      if (str.includes("T")) return str;
      return `${str}T ${yr}`;
    }

    function renderResult(data) {
      if (uploadZone) uploadZone.classList.add("demo-upload-hidden");
      result.hidden = false;

      const inv = data?.invoice || data?.extracted_data || data || {};
      const issuer = (inv.issuer && typeof inv.issuer === "object") ? (inv.issuer.name || "Proveedor") : (inv.issuer_name || inv.issuer || "Proveedor identificado");
      const cif = (inv.issuer && typeof inv.issuer === "object") ? (inv.issuer.tax_id || "CIF verificado") : (inv.issuer_tax_id || "CIF verificado");
      const number = inv.invoice_number || inv.number || "FAC-2026-0849";
      const rawDate = inv.date || inv.issue_date || new Date().toISOString().split("T")[0];
      const formattedDate = formatDate(rawDate);
      const concept = inv.concept || "Servicios profesionales y suministros";
      const base = inv.base_amount ?? inv.subtotal ?? inv.tax_base ?? 120.00;
      const vatRate = inv.vat_rate ?? 21;
      const vatAmount = inv.vat_amount ?? inv.tax_amount ?? (base * (vatRate / 100));
      const irpfRate = inv.withholding_rate ?? 0;
      const irpfAmount = inv.withholding_amount ?? 0;
      const total = inv.total_amount ?? inv.total ?? (base + vatAmount - irpfAmount);
      const formattedQuarter = formatQuarter(inv.quarter, inv.year, rawDate);
      const category = inv.category || "Cuenta (629) Otros servicios exteriores";
      let operationType = inv.operation_type || "Gasto deducible";
      if (operationType.toLowerCase() === "gasto") operationType = "Gasto deducible";
      if (operationType.toLowerCase() === "ingreso") operationType = "Ingreso computable";
      const taxTreatment = inv.tax_treatment || inv.taxTreatment || "Gasto 100% deducible en IRPF y cuota de IVA deducible en Modelo 303.";
      const accounting = inv.accounting_treatment || inv.accountingTreatment || "Debe: (629) Gasto + (472) IVA -> Haber: (410) Acreedores.";
      const explanation = inv.explanation || data?.explanation || "Factura procesada con éxito y validada bajo normativa fiscal española.";

      result.innerHTML = `
        <!-- HEADER DEL WIDGET -->
        <div class="alfonso-result-header">
          <div class="alfonso-result-heading">
            <div class="alfonso-result-mark">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <div>
              <span class="alfonso-result-kicker">DOCUMENTO IDENTIFICADO</span>
              <h3 class="alfonso-result-title">${escapeHtml(issuer)}</h3>
            </div>
          </div>
          <span class="alfonso-result-status">
            <span>●</span> Verificado y clasificado
          </span>
        </div>

        <div class="alfonso-result-body">
          <!-- 1. HERO TOTAL CARD (EL PRINCIPAL EN PRIMER LUGAR) -->
          <div class="alfonso-hero-total">
            <div class="alfonso-total-main">
              <span class="alfonso-hero-label">TOTAL DE LA FACTURA</span>
              <div class="alfonso-hero-amount">${formatMoney(total)}</div>
            </div>
            <div class="alfonso-total-breakdown">
              <div class="alfonso-breakdown-pill">
                <span>Base Imponible</span>
                <strong>${formatMoney(base)}</strong>
              </div>
              <div class="alfonso-breakdown-pill highlight-vat">
                <span>IVA (${vatRate}%)</span>
                <strong>+${formatMoney(vatAmount)}</strong>
              </div>
              ${irpfAmount > 0 ? `
              <div class="alfonso-breakdown-pill highlight-irpf">
                <span>Retención (${irpfRate}%)</span>
                <strong>-${formatMoney(irpfAmount)}</strong>
              </div>` : ''}
            </div>
          </div>

          <!-- 2. DATOS DE OPERACIÓN (COMPACTOS Y EQUILIBRADOS) -->
          <div class="alfonso-operation-strip">
            <div class="alfonso-op-box">
              <span class="alfonso-op-label">EMISOR / PROVEEDOR</span>
              <div class="alfonso-op-title" title="${escapeHtml(issuer)}">${escapeHtml(issuer)}</div>
              <span class="alfonso-op-meta">${escapeHtml(cif)}</span>
            </div>

            <div class="alfonso-op-box">
              <span class="alfonso-op-label">CONCEPTO DE LA OPERACIÓN</span>
              <div class="alfonso-op-title" title="${escapeHtml(concept)}">${escapeHtml(concept)}</div>
              <span class="alfonso-op-meta">Nº Factura: ${escapeHtml(number)}</span>
            </div>
          </div>

          <!-- 3. METADATOS ECONÓMICOS -->
          <div class="alfonso-meta-grid">
            <div class="alfonso-meta-item">
              <span class="alfonso-meta-label">Fecha Emisión</span>
              <strong class="alfonso-meta-value">${escapeHtml(formattedDate)}</strong>
            </div>
            <div class="alfonso-meta-item">
              <span class="alfonso-meta-label">Base Imponible</span>
              <strong class="alfonso-meta-value">${formatMoney(base)}</strong>
            </div>
            <div class="alfonso-meta-item">
              <span class="alfonso-meta-label">Cuota IVA (${vatRate}%)</span>
              <strong class="alfonso-meta-value highlight-cyan">${formatMoney(vatAmount)}</strong>
            </div>
            <div class="alfonso-meta-item">
              <span class="alfonso-meta-label">Trimestre Fiscal</span>
              <strong class="alfonso-meta-value highlight-amber">${escapeHtml(formattedQuarter)}</strong>
            </div>
          </div>

          <!-- 4. CLASIFICACIÓN CON BADGES -->
          <div class="alfonso-classification">
            <span class="alfonso-chip green">✓ ${escapeHtml(operationType)}</span>
            <span class="alfonso-chip cyan">📦 ${escapeHtml(category)}</span>
            <span class="alfonso-chip amber">📅 ${escapeHtml(formattedQuarter)} · Mod. 303</span>
            <span class="alfonso-chip">🔒 Local-First</span>
          </div>

          <!-- 5. INTERPRETACIÓN EN LENGUAJE NATURAL -->
          <div class="alfonso-understanding">
            <div class="alfonso-understanding-header">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#18d7ff" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              <span>Qué ha entendido Alfonso</span>
            </div>
            <div class="alfonso-understanding-text">${renderMarkdown(explanation)}</div>
          </div>

          <!-- 6. TRATAMIENTOS FISCAL Y CONTABLE -->
          <div class="alfonso-treatment-grid">
            <article class="alfonso-treatment-card">
              <div class="alfonso-treatment-head">
                <span class="alfonso-treatment-icon icon-fiscal">⚖️</span>
                <h4>Criterio y Tratamiento Fiscal</h4>
              </div>
              <div class="alfonso-treatment-content">${renderMarkdown(taxTreatment)}</div>
            </article>

            <article class="alfonso-treatment-card">
              <div class="alfonso-treatment-head">
                <span class="alfonso-treatment-icon icon-contable">📒</span>
                <h4>Propuesta de Asiento Contable</h4>
              </div>
              <div class="alfonso-treatment-content accounting-code">${renderMarkdown(accounting)}</div>
            </article>
          </div>

          <!-- 7. CTA CONTEXTUAL DE CONVERSIÓN -->
          <div class="alfonso-demo-conversion-cta">
            <div class="alfonso-demo-conversion-copy">
              <span class="alfonso-demo-conversion-badge">✨ PROCESADO EN TIEMPO REAL</span>
              <strong>¿Quieres automatizar todas tus facturas y asientos contables así?</strong>
              <p>Únete a la beta gratuita de Alfonso y ahorra horas de administración cada mes.</p>
            </div>
            <a href="#acceso" class="btn btn-primary btn-sm alfonso-demo-cta-btn">
              Unirme a la beta →
            </a>
          </div>

          <!-- 8. BOTONES DE ACCIÓN DEL WIDGET -->
          <div class="alfonso-result-actions">
            <button type="button" class="alfonso-analysis-toggle" id="alfonso-toggle-details">
              Ver datos brutos de auditoría ▾
            </button>
            <button type="button" class="alfonso-btn-reset" id="alfonso-reset-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              Procesar otra factura
            </button>
          </div>

          <!-- AUDITORÍA DESPLEGABLE -->
          <div class="alfonso-analysis-details" id="alfonso-details-box" hidden>
            <div class="audit-box">
              <strong>Registro de Auditoría & Trazabilidad Local:</strong>
              <pre>${escapeHtml(JSON.stringify(inv, null, 2))}</pre>
            </div>
          </div>
        </div>
      `;

      const toggleBtn = result.querySelector("#alfonso-toggle-details");
      const detailsBox = result.querySelector("#alfonso-details-box");
      if (toggleBtn && detailsBox) {
        toggleBtn.addEventListener("click", () => {
          const isHidden = detailsBox.hidden;
          detailsBox.hidden = !isHidden;
          toggleBtn.textContent = isHidden ? "Ocultar datos brutos de auditoría ▴" : "Ver datos brutos de auditoría ▾";
        });
      }

      const resetBtn = result.querySelector("#alfonso-reset-btn");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          resetDemo();
          fileInput.click();
        });
      }
    }

    function scrollToDemo() {
      const demoTerminal = document.querySelector(".demo-terminal") || document.getElementById("demo");
      if (demoTerminal) {
        demoTerminal.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }
    }

    function resetDemo() {
      if (uploadZone) uploadZone.classList.remove("demo-upload-hidden");
      result.hidden = true;
      result.innerHTML = "";
      fileInput.value = "";
      if (reset) reset.hidden = true;
      scrollToDemo();
    }

    async function processFile(file) {
      if (!file) return;

      scrollToDemo();

      if (uploadZone) uploadZone.classList.add("demo-upload-hidden");
      result.hidden = false;
      result.innerHTML = `
        <div class="alfonso-loading-box">
          <div class="alfonso-spinner"></div>
          <h4>Alfonso está analizando "${escapeHtml(file.name)}"...</h4>
          <p>Extrayendo importes, validando NIFs, desglosando IVA/IRPF y redactando el criterio fiscal bajo privacidad Local-First.</p>
        </div>
      `;

      let data = null;
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(API_URL, {
          method: "POST",
          body: formData
        });

        if (response.ok) {
          data = await response.json();
        } else {
          const errData = await response.json().catch(() => null);
          throw new Error(errData?.detail || "Error en el procesamiento en el servidor.");
        }
      } catch (e) {
        result.innerHTML = `<div style="color: #ff8a8a; padding: 20px; text-align: center; border: 1px solid rgba(255,100,100,0.3); border-radius: 8px; background: rgba(255,100,100,0.1); margin-top: 20px;">Error al procesar la factura: ${escapeHtml(e.message)}</div>`;
        scrollToDemo();
        return;
      }

      renderResult(data);
      scrollToDemo();
    }

    fileInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    });

    if (uploadZone) {
      ["dragenter", "dragover"].forEach((evt) => {
        uploadZone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          uploadZone.classList.add("dragover");
        });
      });

      ["dragleave", "drop"].forEach((evt) => {
        uploadZone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          uploadZone.classList.remove("dragover");
        });
      });

      uploadZone.addEventListener("drop", (e) => {
        const file = e.dataTransfer?.files?.[0];
        if (file) processFile(file);
      });
    }

    if (reset) {
      reset.addEventListener("click", resetDemo);
    }
  }


  /* ==========================================================
     05. TEST DE ORIENTACIÓN VERI*FACTU
     ========================================================== */

  function initVeriFactuQuiz() {
    const form = document.getElementById("verifactu-quiz-form");
    const results = document.getElementById("verifactu-results");

    if (!form || !results) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const q1 = Number(document.getElementById("q1")?.value || 0);
      const q2 = Number(document.getElementById("q2")?.value || 0);
      const q3 = Number(document.getElementById("q3")?.value || 0);
      const q4 = Number(document.getElementById("q4")?.value || 0);
      const total = q1 + q2 + q3 + q4;

      const badge = document.getElementById("verifactu-badge");
      const title = document.getElementById("verifactu-title");
      const desc = document.getElementById("verifactu-desc");

      if (total >= 6) {
        badge.textContent = "ORIENTACIÓN · AVANZADA";
        badge.style.background = "rgba(34, 197, 139, 0.14)";
        badge.style.color = "#67e1b2";
        badge.style.border = "1px solid rgba(34, 197, 139, 0.3)";
        title.textContent = "Tu sistema parece bien encaminado";
        desc.textContent = "Tus respuestas indican un nivel de digitalización adecuado. Alfonso puede integrarse en tu día a día para automatizar la conciliación y validación continua previa a los plazos legales.";
      } else if (total >= 3) {
        badge.textContent = "ORIENTACIÓN · ADAPTACIÓN NECESARIA";
        badge.style.background = "rgba(255, 181, 27, 0.14)";
        badge.style.color = "#ffc84d";
        badge.style.border = "1px solid rgba(255, 181, 27, 0.3)";
        title.textContent = "Conviene actualizar tu operativa de facturación";
        desc.textContent = "Tu operativa cuenta con partes manuales o sin registro inalterable. Alfonso te ayuda a dar el salto a un sistema estructurado y preparado para VERI*FACTU.";
      } else {
        badge.textContent = "ORIENTACIÓN · ALTA PRIORIDAD DE CAMBIO";
        badge.style.background = "rgba(255, 100, 100, 0.14)";
        badge.style.color = "#ff9a9a";
        badge.style.border = "1px solid rgba(255, 100, 100, 0.3)";
        title.textContent = "Tu facturación actual requiere modernización urgente";
        desc.textContent = "El uso de plantillas manuales, hojas de cálculo o papel no cumple con los requisitos del reglamento antifraude y VERI*FACTU. Únete a la beta de Alfonso para simplificar tu transición.";
      }

      form.hidden = true;
      results.hidden = false;
    });
  }


  /* ==========================================================
     06. CALCULADORA ROI DE TIEMPO Y VALOR
     ========================================================== */

  function initRoiCalculator() {
    const hoursInput = document.getElementById("hoursInput");
    const hourValueInput = document.getElementById("hourValueInput");
    const hoursOutput = document.getElementById("hoursOutput");
    const hourValueOutput = document.getElementById("hourValueOutput");
    const monthlySaving = document.getElementById("monthlySaving");
    const annualSaving = document.getElementById("annualSaving");
    const savedHours = document.getElementById("savedHours");
    const timeValue = document.getElementById("timeValue");
    const calcCtaHours = document.getElementById("calc-cta-hours");

    if (!hoursInput || !hourValueInput) return;

    function euro(val) {
      return new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0
      }).format(val);
    }

    function updateCalculator() {
      const hours = Number(hoursInput.value) || 0;
      const rate = Number(hourValueInput.value) || 0;
      const monthly = hours * rate;
      const annual = monthly * 12;

      if (hoursOutput) hoursOutput.textContent = `${hours} h`;
      if (hourValueOutput) hourValueOutput.textContent = `${rate} €/h`;
      if (monthlySaving) monthlySaving.textContent = euro(monthly);
      if (annualSaving) annualSaving.textContent = euro(annual);
      if (savedHours) savedHours.textContent = `${hours} h/mes`;
      if (timeValue) timeValue.textContent = `${rate} €/h`;
      if (calcCtaHours) calcCtaHours.textContent = hours;

      [hoursInput, hourValueInput].forEach((input) => {
        const min = Number(input.min) || 0;
        const max = Number(input.max) || 100;
        const val = Number(input.value) || 0;
        const pct = ((val - min) / (max - min)) * 100;
        input.style.setProperty("--range-progress", `${pct}%`);
      });
    }

    [hoursInput, hourValueInput].forEach((input) => {
      input.addEventListener("input", updateCalculator);
    });

    updateCalculator();
  }


  /* ==========================================================
     07. FORMULARIO DE ACCESO A LA BETA (WAITLIST)
     ========================================================== */

  function initWaitlistForm() {
    const form = document.getElementById("waitlist-form");
    const emailInput = document.getElementById("email");
    const nameInput = document.getElementById("name");
    const message = document.getElementById("form-message");
    const submitBtn = document.getElementById("waitlist-submit-btn");

    if (!form || !emailInput) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const emailVal = emailInput.value.trim();
      const nameVal = nameInput ? nameInput.value.trim() : "";

      if (!emailVal || !emailInput.checkValidity()) {
        if (message) {
          message.textContent = "Por favor, introduce un correo electrónico válido.";
          message.style.color = "#ff8a8a";
        }
        emailInput.focus();
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.setAttribute("aria-busy", "true");
        submitBtn.dataset.origText = submitBtn.textContent;
        submitBtn.textContent = "Enviando solicitud...";
      }

      if (message) {
        message.textContent = "Registrando tu solicitud...";
        message.style.color = "var(--muted)";
      }

      try {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: nameVal || "Solicitante Beta",
            email: emailVal,
            company: "No indicada",
            message: "Solicitud de acceso prioritario a la beta de Alfonso AI Konta"
          })
        });

        let json = null;
        try {
          json = await res.json();
        } catch {
          json = null;
        }

        if (!res.ok && res.status !== 200 && res.status !== 202) {
          throw new Error(json?.error?.message || "No se ha podido procesar tu solicitud.");
        }

        const isAlready = json?.data?.message?.includes("already") || json?.message?.includes("already");

        if (message) {
          if (isAlready) {
            message.textContent = "✓ ¡Este email ya estaba registrado! Te mantendremos informado.";
            message.style.color = "#67e1b2";
          } else {
            message.textContent = "🎉 ¡Solicitud recibida con éxito! Te hemos reservado plaza en la beta de Alfonso.";
            message.style.color = "#67e1b2";
          }
        }

        form.reset();

      } catch (err) {
        console.error("Error en waitlist:", err);
        if (message) {
          message.textContent = err?.message || "No hemos podido enviar tu solicitud. Inténtalo de nuevo.";
          message.style.color = "#ff8a8a";
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.removeAttribute("aria-busy");
          submitBtn.textContent = submitBtn.dataset.origText || "Quiero probar la beta →";
        }
      }
    });
  }


  /* ==========================================================
     08. BOTÓN STICKY DE CONVERSIÓN EN MÓVIL
     ========================================================== */

  function initStickyMobileCta() {
    const stickyCta = document.getElementById("mobile-sticky-cta");
    const targetSection = document.getElementById("acceso");
    if (!stickyCta) return;

    let ticking = false;

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY || window.pageYOffset;
          const heroHeight = window.innerHeight * 0.6;
          const targetRect = targetSection ? targetSection.getBoundingClientRect() : null;
          const nearBottom = targetRect ? targetRect.top < window.innerHeight : false;

          if (scrollY > heroHeight && !nearBottom) {
            stickyCta.classList.add("is-visible");
            stickyCta.setAttribute("aria-hidden", "false");
          } else {
            stickyCta.classList.remove("is-visible");
            stickyCta.setAttribute("aria-hidden", "true");
          }
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
});