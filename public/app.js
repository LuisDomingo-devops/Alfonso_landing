document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  /* ==========================================================
     ALFONSO AI KONTA
     Demo de procesamiento de facturas
     ========================================================== */


  /* ==========================================================
     01. NAVEGACIÓN MÓVIL
     ========================================================== */

  const menu = document.getElementById("mobile-menu");
  const nav = document.getElementById("nav-links");

  if (menu && nav) {
    menu.addEventListener("click", () => {
      const open = nav.classList.toggle("open");

      menu.setAttribute(
        "aria-expanded",
        String(open)
      );
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("open");

        menu.setAttribute(
          "aria-expanded",
          "false"
        );
      });
    });
  }


  /* ==========================================================
     02. ELEMENTOS DE LA DEMO
     ========================================================== */

  const uploadZone =
    document.getElementById("upload-zone");

  const fileInput =
    document.getElementById("file-input");

  const result =
    document.getElementById("demo-result");

  const reset =
    document.getElementById("reset-demo");


  if (!fileInput || !result) {
    return;
  }


  /* ==========================================================
     03. BACKEND
     ========================================================== */

  const API_URL =
    window.ALFONSO_INVOICE_API ||
    "http://127.0.0.1:8000/api/invoice-demo";


  /* ==========================================================
     04. ESTILOS EXCLUSIVOS DE LA DEMO
     ========================================================== */

  const demoStyle =
    document.createElement("style");

  demoStyle.textContent = `

    /* ======================================================
       ESTADO DE LA ZONA DE SUBIDA
       ====================================================== */

    .demo-upload-hidden {
      display: none !important;
    }


    /* ======================================================
       RESULTADO
       ====================================================== */

    .demo-result {
      position: relative;
      overflow: hidden;

      padding: 0 !important;

      border: 1px solid rgba(24, 215, 255, .14) !important;
      border-radius: 16px !important;

      background:
        radial-gradient(
          circle at 90% 0%,
          rgba(24, 215, 255, .075),
          transparent 34%
        ),
        linear-gradient(
          145deg,
          #0d151e,
          #080d14
        ) !important;

      color: #dce6ef !important;

      box-shadow:
        0 18px 45px rgba(0, 0, 0, .24),
        inset 0 1px 0 rgba(255, 255, 255, .025);

      animation:
        alfonsoDemoAppear .38s ease both;
    }


    @keyframes alfonsoDemoAppear {
      from {
        opacity: 0;
        transform:
          translateY(8px)
          scale(.99);
      }

      to {
        opacity: 1;
        transform:
          translateY(0)
          scale(1);
      }
    }


    /* ======================================================
       CABECERA
       ====================================================== */

    .alfonso-result-header {
      display: flex;
      align-items: center;
      justify-content: space-between;

      gap: 16px;

      padding: 17px 18px;

      border-bottom:
        1px solid rgba(255, 255, 255, .07);
    }


    .alfonso-result-heading {
      display: flex;
      align-items: center;

      min-width: 0;

      gap: 11px;
    }


    .alfonso-result-mark {
      width: 37px;
      height: 37px;

      min-width: 37px;

      display: grid;
      place-items: center;

      border-radius: 11px;

      background:
        linear-gradient(
          145deg,
          rgba(24, 215, 255, .15),
          rgba(24, 215, 255, .045)
        );

      border:
        1px solid rgba(24, 215, 255, .22);

      color: var(--cyan, #18d7ff);

      box-shadow:
        0 0 24px rgba(24, 215, 255, .07);
    }


    .alfonso-result-heading-text {
      min-width: 0;
    }


    .alfonso-result-kicker {
      display: block;

      margin-bottom: 2px;

      color: #18d7ff;

      font-size: 9px;
      font-weight: 850;

      letter-spacing: .12em;
    }


    .alfonso-result-title {
      margin: 0;

      color: #fff;

      font-family:
        var(--heading, "Outfit", sans-serif);

      font-size: 15px;
      font-weight: 750;

      line-height: 1.25;

      letter-spacing: -.015em;
    }


    .alfonso-result-status {
      display: inline-flex;
      align-items: center;

      flex-shrink: 0;

      gap: 6px;

      padding: 6px 9px;

      border-radius: 999px;

      border:
        1px solid rgba(34, 197, 139, .18);

      background:
        rgba(34, 197, 139, .07);

      color: #75e0b1;

      font-size: 9px;
      font-weight: 750;

      white-space: nowrap;
    }


    .alfonso-result-status::before {
      content: "";

      width: 5px;
      height: 5px;

      border-radius: 50%;

      background: #22c58b;

      box-shadow:
        0 0 9px rgba(34, 197, 139, .7);
    }


    /* ======================================================
       CUERPO
       ====================================================== */

    .alfonso-result-body {
      padding: 18px;
    }


    /* ======================================================
       DATOS PRINCIPALES
       ====================================================== */

    .alfonso-main-facts {
      display: grid;

      grid-template-columns:
        minmax(0, 1fr)
        minmax(0, 1fr);

      gap: 9px;
    }


    .alfonso-fact-card {
      position: relative;

      min-width: 0;

      padding: 13px 14px;

      border:
        1px solid rgba(255, 255, 255, .065);

      border-radius: 11px;

      background:
        rgba(255, 255, 255, .025);

      transition:
        border-color .2s ease,
        background .2s ease,
        transform .2s ease;
    }


    .alfonso-fact-card:hover {
      transform: translateY(-1px);

      border-color:
        rgba(24, 215, 255, .17);

      background:
        rgba(24, 215, 255, .035);
    }


    .alfonso-fact-card.total {
      grid-column: 1 / -1;

      padding: 17px 16px;

      border-color:
        rgba(24, 215, 255, .18);

      background:
        linear-gradient(
          120deg,
          rgba(24, 215, 255, .07),
          rgba(24, 215, 255, .018)
        );
    }


    .alfonso-fact-label {
      display: block;

      margin-bottom: 5px;

      color: #718095;

      font-size: 8px;
      font-weight: 800;

      letter-spacing: .1em;

      text-transform: uppercase;
    }


    .alfonso-fact-value {
      display: block;

      overflow: hidden;

      color: #f3f7fa;

      font-size: 12px;
      font-weight: 650;

      line-height: 1.4;

      text-overflow: ellipsis;

      white-space: nowrap;
    }


    .alfonso-fact-value.total-value {
      color: #fff;

      font-family:
        var(--heading, "Outfit", sans-serif);

      font-size: 28px;
      font-weight: 850;

      line-height: 1;

      letter-spacing: -.045em;
    }


    /* ======================================================
       METADATOS
       ====================================================== */

    .alfonso-meta-grid {
      display: grid;

      grid-template-columns:
        repeat(2, minmax(0, 1fr));

      gap: 8px;

      margin-top: 9px;
    }


    .alfonso-meta-item {
      padding: 10px 12px;

      border-radius: 9px;

      background:
        rgba(255, 255, 255, .018);

      border:
        1px solid rgba(255, 255, 255, .045);
    }


    .alfonso-meta-label {
      display: block;

      margin-bottom: 3px;

      color: #667487;

      font-size: 8px;
      font-weight: 700;

      text-transform: uppercase;

      letter-spacing: .07em;
    }


    .alfonso-meta-value {
      display: block;

      overflow: hidden;

      color: #d6dfe8;

      font-size: 10px;
      font-weight: 600;

      white-space: nowrap;

      text-overflow: ellipsis;
    }


    /* ======================================================
       CLASIFICACIÓN
       ====================================================== */

    .alfonso-classification {
      display: flex;

      align-items: center;

      flex-wrap: wrap;

      gap: 6px;

      margin-top: 12px;
    }


    .alfonso-classification-label {
      width: 100%;

      margin-bottom: 1px;

      color: #718095;

      font-size: 8px;
      font-weight: 750;

      text-transform: uppercase;

      letter-spacing: .08em;
    }


    .alfonso-chip {
      display: inline-flex;

      align-items: center;

      min-height: 23px;

      padding: 4px 8px;

      border-radius: 7px;

      border:
        1px solid rgba(24, 215, 255, .14);

      background:
        rgba(24, 215, 255, .055);

      color: #bceefa;

      font-size: 9px;
      font-weight: 650;
    }


    .alfonso-chip.amber {
      border-color:
        rgba(255, 181, 27, .16);

      background:
        rgba(255, 181, 27, .055);

      color: #f7d47e;
    }


    /* ======================================================
       INTERPRETACIÓN
       ====================================================== */

    .alfonso-understanding {
      position: relative;

      margin-top: 14px;

      padding: 15px;

      border-radius: 12px;

      border:
        1px solid rgba(24, 215, 255, .11);

      background:
        linear-gradient(
          135deg,
          rgba(24, 215, 255, .055),
          rgba(255, 255, 255, .018)
        );
    }


    .alfonso-understanding::before {
      content: "";

      position: absolute;

      top: 13px;
      bottom: 13px;
      left: 0;

      width: 2px;

      border-radius: 2px;

      background:
        linear-gradient(
          #18d7ff,
          rgba(24, 215, 255, 0)
        );
    }


    .alfonso-understanding-label {
      display: flex;

      align-items: center;

      gap: 7px;

      margin-bottom: 7px;

      color: #dffaff;

      font-size: 9px;
      font-weight: 800;

      letter-spacing: .06em;
    }


    .alfonso-understanding-label::before {
      content: "";

      width: 7px;
      height: 7px;

      border-radius: 50%;

      background:
        var(--cyan, #18d7ff);

      box-shadow:
        0 0 10px rgba(24, 215, 255, .4);
    }


    .alfonso-understanding-text {
      margin: 0;

      color: #aebdca;

      font-size: 11px;

      line-height: 1.6;
    }


    /* ======================================================
       TRATAMIENTO
       ====================================================== */

    .alfonso-treatment-grid {
      display: grid;

      grid-template-columns:
        repeat(2, minmax(0, 1fr));

      gap: 8px;

      margin-top: 9px;
    }


    .alfonso-treatment-card {
      min-width: 0;

      padding: 12px;

      border:
        1px solid rgba(255, 255, 255, .055);

      border-radius: 10px;

      background:
        rgba(255, 255, 255, .02);
    }


    .alfonso-treatment-icon {
      width: 25px;
      height: 25px;

      display: grid;
      place-items: center;

      margin-bottom: 8px;

      border-radius: 7px;

      background:
        rgba(255, 181, 27, .07);

      color: #ffca4b;
    }


    .alfonso-treatment-card:nth-child(2)
    .alfonso-treatment-icon {
      background:
        rgba(34, 197, 139, .07);

      color: #55dca8;
    }


    .alfonso-treatment-title {
      margin: 0 0 5px;

      color: #e7edf3;

      font-size: 10px;
      font-weight: 700;
    }


    .alfonso-treatment-text {
      margin: 0;

      color: #8593a4;

      font-size: 9px;

      line-height: 1.55;
    }


    /* ======================================================
       VER ANÁLISIS
       ====================================================== */

    .alfonso-analysis-toggle {
      width: 100%;

      display: flex;

      align-items: center;
      justify-content: space-between;

      margin-top: 12px;

      padding: 10px 11px;

      border:
        1px solid rgba(255, 255, 255, .065);

      border-radius: 9px;

      background:
        rgba(255, 255, 255, .018);

      color: #aebdca;

      font-family: inherit;

      font-size: 9px;
      font-weight: 700;

      text-align: left;

      cursor: pointer;

      transition:
        background .2s ease,
        border-color .2s ease,
        color .2s ease;
    }


    .alfonso-analysis-toggle:hover {
      border-color:
        rgba(24, 215, 255, .17);

      background:
        rgba(24, 215, 255, .035);

      color: #fff;
    }


    .alfonso-analysis-toggle-content {
      display: flex;

      align-items: center;

      gap: 7px;
    }


    .alfonso-analysis-toggle-icon {
      width: 22px;
      height: 22px;

      display: grid;
      place-items: center;

      border-radius: 6px;

      background:
        rgba(24, 215, 255, .07);

      color:
        var(--cyan, #18d7ff);
    }


    .alfonso-analysis-chevron {
      width: 14px;
      height: 14px;

      transition:
        transform .25s ease;
    }


    .alfonso-analysis-toggle.open
    .alfonso-analysis-chevron {
      transform:
        rotate(180deg);
    }


    /* ======================================================
       CONTENEDOR DEL ANÁLISIS
       ====================================================== */

    .alfonso-analysis-details {
      max-height: 0;

      overflow: hidden;

      margin-top: 0;

      border:
        1px solid transparent;

      border-radius: 10px;

      background:
        rgba(0, 0, 0, .14);

      opacity: 0;

      transition:
        max-height .35s ease,
        margin-top .25s ease,
        opacity .25s ease,
        border-color .25s ease;
    }


    .alfonso-analysis-details.open {
      max-height: 245px;

      margin-top: 8px;

      border-color:
        rgba(255, 255, 255, .055);

      opacity: 1;
    }


    .alfonso-analysis-details-title {
      padding: 10px 12px;

      border-bottom:
        1px solid rgba(255, 255, 255, .05);

      color: #dce5ed;

      font-size: 9px;
      font-weight: 750;
    }


    /*
       ESTE ES EL SCROLL.

       El contenedor exterior tiene una altura máxima.
       El interior siempre permite desplazamiento vertical
       cuando el texto supera la altura disponible.
    */

    .alfonso-analysis-scroll {
      max-height: 195px;

      overflow-y: auto;

      padding: 12px;

      scrollbar-width: thin;

      scrollbar-color:
        rgba(255, 255, 255, .25)
        transparent;
    }


    .alfonso-analysis-scroll::-webkit-scrollbar {
      width: 5px;
    }


    .alfonso-analysis-scroll::-webkit-scrollbar-track {
      background: transparent;
    }


    .alfonso-analysis-scroll::-webkit-scrollbar-thumb {
      border-radius: 999px;

      background:
        rgba(255, 255, 255, .25);
    }


    .alfonso-analysis-text {
      margin: 0;

      color: #aebbc8;

      font-size: 10px;

      line-height: 1.7;

      white-space: pre-line;
    }


    /* ======================================================
       BOTÓN NUEVA FACTURA
       ====================================================== */

    .alfonso-new-document {
      width: 100%;

      display: inline-flex;

      align-items: center;
      justify-content: center;

      gap: 7px;

      margin-top: 10px;

      padding: 10px 12px;

      border:
        1px solid rgba(24, 215, 255, .13);

      border-radius: 9px;

      background:
        rgba(24, 215, 255, .045);

      color: #9ee9f7;

      font-family: inherit;

      font-size: 9px;
      font-weight: 700;

      cursor: pointer;

      transition:
        background .2s ease,
        border-color .2s ease,
        color .2s ease;
    }


    .alfonso-new-document:hover {
      border-color:
        rgba(24, 215, 255, .28);

      background:
        rgba(24, 215, 255, .08);

      color: #fff;
    }


    /* ======================================================
       FOOTER
       ====================================================== */

    .alfonso-result-footer {
      display: flex;

      align-items: center;
      justify-content: space-between;

      gap: 10px;

      margin-top: 13px;
      padding-top: 10px;

      border-top:
        1px solid rgba(255, 255, 255, .045);

      color: #586677;

      font-size: 8px;
    }


    .alfonso-result-footer-left {
      display: flex;

      align-items: center;

      gap: 6px;
    }


    .alfonso-footer-dot {
      width: 5px;
      height: 5px;

      border-radius: 50%;

      background: #22c58b;
    }


    /* ======================================================
       LOADING
       ====================================================== */

    .alfonso-loading {
      display: flex;

      align-items: center;

      gap: 11px;

      padding: 18px;

      color: #c9d4de;

      font-size: 11px;
    }


    .alfonso-spinner {
      width: 17px;
      height: 17px;

      flex-shrink: 0;

      border:
        2px solid rgba(255, 255, 255, .12);

      border-top-color:
        var(--cyan, #18d7ff);

      border-radius: 50%;

      animation:
        alfonsoSpin .8s linear infinite;
    }


    @keyframes alfonsoSpin {
      to {
        transform: rotate(360deg);
      }
    }


    /* ======================================================
       ERROR
       ====================================================== */

    .alfonso-error {
      padding: 18px;

      color: #ffd5d5;

      font-size: 10px;

      line-height: 1.6;

      background:
        rgba(150, 35, 35, .09);

      border:
        1px solid rgba(220, 90, 90, .14);

      border-radius: 12px;
    }


    .alfonso-error strong {
      color: #fff;
    }


    /* ======================================================
       RESPONSIVE
       ====================================================== */

    @media (max-width: 620px) {

      .alfonso-result-header {
        align-items: flex-start;

        flex-direction: column;
      }


      .alfonso-result-status {
        align-self: flex-start;
      }


      .alfonso-main-facts {
        grid-template-columns: 1fr;
      }


      .alfonso-fact-card.total {
        grid-column: auto;
      }


      .alfonso-treatment-grid {
        grid-template-columns: 1fr;
      }


      .alfonso-result-footer {
        align-items: flex-start;

        flex-direction: column;
      }


      .alfonso-analysis-details.open {
        max-height: 255px;
      }


      .alfonso-analysis-scroll {
        max-height: 205px;
      }
    }


    @media (max-width: 420px) {

      .alfonso-result-body {
        padding: 14px;
      }


      .alfonso-result-header {
        padding: 14px;
      }


      .alfonso-meta-grid {
        grid-template-columns: 1fr;
      }


      .alfonso-fact-value.total-value {
        font-size: 25px;
      }
    }

  `;

  document.head.appendChild(demoStyle);


  /* ==========================================================
     05. UTILIDADES
     ========================================================== */

  function escapeHtml(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function formatMoney(value) {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "—";
    }

    const numeric =
      Number(value);

    if (Number.isNaN(numeric)) {
      return escapeHtml(value);
    }

    return new Intl.NumberFormat(
      "es-ES",
      {
        style: "currency",
        currency: "EUR"
      }
    ).format(numeric);
  }


  function firstValue(
    object,
    paths,
    fallback = ""
  ) {

    for (const path of paths) {

      const parts =
        path.split(".");

      let current =
        object;

      for (const part of parts) {

        if (
          current === null ||
          current === undefined
        ) {
          current = undefined;
          break;
        }

        current =
          current[part];
      }

      if (
        current !== undefined &&
        current !== null &&
        current !== ""
      ) {
        return current;
      }
    }

    return fallback;
  }


  /* ==========================================================
     06. NORMALIZACIÓN DE RESPUESTA
     ========================================================== */

  function normalizeResult(data) {

    const invoice =
      data?.invoice ||
      data?.document ||
      data?.extracted_data ||
      data?.data ||
      {};


    const issuer =
      firstValue(
        invoice,
        [
          "issuer.name",
          "supplier.name",
          "provider.name",
          "vendor.name",
          "issuer",
          "supplier",
          "provider",
          "vendor"
        ],
        "No identificado"
      );


    const concept =
      firstValue(
        invoice,
        [
          "concept",
          "description",
          "concepto",
          "description_text",
          "line_description"
        ],
        "No identificado"
      );


    const date =
      firstValue(
        invoice,
        [
          "date",
          "invoice_date",
          "issue_date",
          "fecha"
        ],
        "No identificada"
      );


    const invoiceNumber =
      firstValue(
        invoice,
        [
          "invoice_number",
          "number",
          "invoice_id",
          "numero_factura",
          "reference"
        ],
        "No identificado"
      );


    const baseAmount =
      firstValue(
        invoice,
        [
          "base_amount",
          "taxable_base",
          "subtotal",
          "base",
          "base_imponible"
        ],
        null
      );


    const vatAmount =
      firstValue(
        invoice,
        [
          "vat_amount",
          "tax_amount",
          "iva",
          "iva_amount"
        ],
        null
      );


    const totalAmount =
      firstValue(
        invoice,
        [
          "total_amount",
          "total",
          "amount",
          "importe_total"
        ],
        null
      );


    const operationType =
      firstValue(
        invoice,
        [
          "operation_type",
          "document_type",
          "type",
          "operation",
          "tipo_operacion"
        ],
        "Factura"
      );


    const category =
      firstValue(
        invoice,
        [
          "category",
          "expense_category",
          "classification",
          "categoria"
        ],
        "Sin categoría"
      );


    const year =
      firstValue(
        invoice,
        [
          "year",
          "fiscal_year"
        ],
        null
      );


    const quarter =
      firstValue(
        invoice,
        [
          "quarter",
          "fiscal_quarter",
          "trimestre"
        ],
        null
      );


    const explanation =
      firstValue(
        data,
        [
          "explanation",
          "interpretation",
          "analysis",
          "response",
          "message",
          "summary"
        ],
        "Alfonso ha analizado el documento y ha estructurado la información relevante."
      );


    const taxTreatment =
      firstValue(
        data,
        [
          "tax_treatment",
          "fiscal_treatment",
          "invoice.tax_treatment",
          "invoice.fiscal_treatment",
          "fiscal",
          "tax_analysis"
        ],
        "Alfonso ha identificado el tratamiento fiscal aplicable a la operación."
      );


    const accountingTreatment =
      firstValue(
        data,
        [
          "accounting_treatment",
          "invoice.accounting_treatment",
          "accounting",
          "accounting_analysis",
          "book_entry"
        ],
        "Alfonso ha identificado cómo debe incorporarse la operación al registro contable."
      );


    const extraction =
      firstValue(
        data,
        [
          "processing.extraction",
          "processing.method",
          "extraction_method"
        ],
        "Documento procesado por Alfonso"
      );


    return {
      issuer,
      concept,
      date,
      invoiceNumber,
      baseAmount,
      vatAmount,
      totalAmount,
      operationType,
      category,
      year,
      quarter,
      explanation,
      taxTreatment,
      accountingTreatment,
      extraction
    };
  }


  /* ==========================================================
     07. CAMBIO DE ESTADO DE LA DEMO
     ========================================================== */

  function hideUploadZone() {

    if (!uploadZone) {
      return;
    }

    uploadZone.classList.add(
      "demo-upload-hidden"
    );
  }


  function showUploadZone() {

    if (!uploadZone) {
      return;
    }

    uploadZone.classList.remove(
      "demo-upload-hidden"
    );
  }


  function showResultArea() {

    result.hidden = false;

    result.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }


  function resetDemo() {

    fileInput.value = "";

    result.hidden = true;

    result.innerHTML = "";

    if (reset) {
      reset.hidden = true;
    }

    showUploadZone();

    if (uploadZone) {
      uploadZone.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    }
  }


  /* ==========================================================
     08. LOADING
     ========================================================== */

  function showLoading() {

    hideUploadZone();

    result.hidden = false;

    result.innerHTML = `
      <div class="alfonso-loading">

        <span
          class="alfonso-spinner"
          aria-hidden="true"
        ></span>

        <span>
          Alfonso está analizando el documento...
        </span>

      </div>
    `;

    if (reset) {
      reset.hidden = true;
    }

    showResultArea();
  }


  /* ==========================================================
     09. ERROR
     ========================================================== */

  function showError(message) {

    hideUploadZone();

    result.hidden = false;

    result.innerHTML = `
      <div class="alfonso-error">

        <strong>
          Alfonso no ha podido completar el análisis.
        </strong>

        <br><br>

        ${escapeHtml(message)}

        <button
          type="button"
          class="alfonso-new-document"
          id="alfonso-error-reset"
        >
          Analizar otra factura
        </button>

      </div>
    `;

    if (reset) {
      reset.hidden = true;
    }

    const errorReset =
      document.getElementById(
        "alfonso-error-reset"
      );

    if (errorReset) {
      errorReset.addEventListener(
        "click",
        resetDemo
      );
    }

    showResultArea();
  }


  /* ==========================================================
     10. RENDER RESULTADO
     ========================================================== */

  function renderResult(data) {

    const invoice =
      normalizeResult(data);


    let period =
      "Periodo no determinado";


    if (
      invoice.year &&
      invoice.quarter
    ) {
      period =
        `T${escapeHtml(
          invoice.quarter
        )} ${escapeHtml(
          invoice.year
        )}`;
    }


    result.hidden = false;


    result.innerHTML = `

      <div class="alfonso-result-header">

        <div class="alfonso-result-heading">

          <div
            class="alfonso-result-mark"
            aria-hidden="true"
          >

            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5 12.5L9.2 16.5L19 7"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>

          </div>


          <div
            class="alfonso-result-heading-text"
          >

            <span
              class="alfonso-result-kicker"
            >
              DOCUMENTO IDENTIFICADO
            </span>

            <p
              class="alfonso-result-title"
            >
              Alfonso ha entendido esta factura
            </p>

          </div>

        </div>


        <span
          class="alfonso-result-status"
        >
          Análisis completado
        </span>

      </div>


      <div class="alfonso-result-body">


        <!-- DATOS PRINCIPALES -->

        <div class="alfonso-main-facts">


          <div class="alfonso-fact-card">

            <span
              class="alfonso-fact-label"
            >
              Proveedor
            </span>

            <span
              class="alfonso-fact-value"
              title="${escapeHtml(
                invoice.issuer
              )}"
            >
              ${escapeHtml(
                invoice.issuer
              )}
            </span>

          </div>


          <div class="alfonso-fact-card">

            <span
              class="alfonso-fact-label"
            >
              Concepto
            </span>

            <span
              class="alfonso-fact-value"
              title="${escapeHtml(
                invoice.concept
              )}"
            >
              ${escapeHtml(
                invoice.concept
              )}
            </span>

          </div>


          <div
            class="alfonso-fact-card total"
          >

            <span
              class="alfonso-fact-label"
            >
              Total de la factura
            </span>

            <span
              class="alfonso-fact-value total-value"
            >
              ${formatMoney(
                invoice.totalAmount
              )}
            </span>

          </div>


        </div>


        <!-- METADATOS -->

        <div class="alfonso-meta-grid">


          <div class="alfonso-meta-item">

            <span
              class="alfonso-meta-label"
            >
              Fecha
            </span>

            <span
              class="alfonso-meta-value"
            >
              ${escapeHtml(
                invoice.date
              )}
            </span>

          </div>


          <div class="alfonso-meta-item">

            <span
              class="alfonso-meta-label"
            >
              Nº factura
            </span>

            <span
              class="alfonso-meta-value"
            >
              ${escapeHtml(
                invoice.invoiceNumber
              )}
            </span>

          </div>


          <div class="alfonso-meta-item">

            <span
              class="alfonso-meta-label"
            >
              Base imponible
            </span>

            <span
              class="alfonso-meta-value"
            >
              ${formatMoney(
                invoice.baseAmount
              )}
            </span>

          </div>


          <div class="alfonso-meta-item">

            <span
              class="alfonso-meta-label"
            >
              IVA
            </span>

            <span
              class="alfonso-meta-value"
            >
              ${formatMoney(
                invoice.vatAmount
              )}
            </span>

          </div>


        </div>


        <!-- CLASIFICACIÓN -->

        <div
          class="alfonso-classification"
        >

          <span
            class="alfonso-classification-label"
          >
            Cómo clasifica Alfonso la operación
          </span>


          <span
            class="alfonso-chip"
          >
            ${escapeHtml(
              invoice.operationType
            )}
          </span>


          <span
            class="alfonso-chip"
          >
            ${escapeHtml(
              invoice.category
            )}
          </span>


          <span
            class="alfonso-chip amber"
          >
            ${period}
          </span>

        </div>


        <!-- INTERPRETACIÓN -->

        <div
          class="alfonso-understanding"
        >

          <div
            class="alfonso-understanding-label"
          >
            Qué ha entendido Alfonso
          </div>

          <p
            class="alfonso-understanding-text"
          >
            ${escapeHtml(
              invoice.explanation
            )}
          </p>

        </div>


        <!-- TRATAMIENTO -->

        <div
          class="alfonso-treatment-grid"
        >


          <article
            class="alfonso-treatment-card"
          >

            <div
              class="alfonso-treatment-icon"
              aria-hidden="true"
            >

              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >

                <path
                  d="M4 5H20V19H4V5Z"
                  stroke="currentColor"
                  stroke-width="1.8"
                />

                <path
                  d="M8 9H16M8 13H16M8 17H12"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                />

              </svg>

            </div>


            <p
              class="alfonso-treatment-title"
            >
              Tratamiento fiscal
            </p>


            <p
              class="alfonso-treatment-text"
            >
              ${escapeHtml(
                invoice.taxTreatment
              )}
            </p>

          </article>


          <article
            class="alfonso-treatment-card"
          >

            <div
              class="alfonso-treatment-icon"
              aria-hidden="true"
            >

              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >

                <path
                  d="M5 5H19V19H5V5Z"
                  stroke="currentColor"
                  stroke-width="1.8"
                />

                <path
                  d="M8 9H16M8 13H13M8 17H15"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                />

              </svg>

            </div>


            <p
              class="alfonso-treatment-title"
            >
              Registro contable
            </p>


            <p
              class="alfonso-treatment-text"
            >
              ${escapeHtml(
                invoice.accountingTreatment
              )}
            </p>

          </article>


        </div>


        <!-- VER ANÁLISIS COMPLETO -->

        <button
          type="button"
          class="alfonso-analysis-toggle"
          aria-expanded="false"
        >

          <span
            class="alfonso-analysis-toggle-content"
          >

            <span
              class="alfonso-analysis-toggle-icon"
              aria-hidden="true"
            >

              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >

                <path
                  d="M6 4H18V20H6V4Z"
                  stroke="currentColor"
                  stroke-width="1.8"
                />

                <path
                  d="M9 8H15M9 12H15M9 16H13"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                />

              </svg>

            </span>


            <span>
              Ver análisis completo
            </span>

          </span>


          <svg
            class="alfonso-analysis-chevron"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >

            <path
              d="M6 9L12 15L18 9"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />

          </svg>

        </button>


        <!-- ANÁLISIS CON SCROLL -->

        <div
          class="alfonso-analysis-details"
        >

          <div
            class="alfonso-analysis-details-title"
          >
            Interpretación de Alfonso
          </div>


          <div
            class="alfonso-analysis-scroll"
          >

            <p
              class="alfonso-analysis-text"
            >
              ${escapeHtml(
                invoice.explanation
              )}

              \n\n

              Tratamiento fiscal:
              ${escapeHtml(
                invoice.taxTreatment
              )}

              \n\n

              Registro contable:
              ${escapeHtml(
                invoice.accountingTreatment
              )}

            </p>

          </div>

        </div>


        <!-- NUEVA FACTURA -->

        <button
          type="button"
          class="alfonso-new-document"
          id="alfonso-new-document"
        >

          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >

            <path
              d="M20 11A8 8 0 1 1 17.65 5.35"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />

            <path
              d="M20 5V11H14"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />

          </svg>

          Analizar otra factura

        </button>


        <!-- FOOTER -->

        <div
          class="alfonso-result-footer"
        >

          <div
            class="alfonso-result-footer-left"
          >

            <span
              class="alfonso-footer-dot"
            ></span>

            <span>
              Información procesada por Alfonso
            </span>

          </div>


          <span>
            ${escapeHtml(
              invoice.extraction
            )}
          </span>

        </div>


      </div>
    `;


    if (reset) {
      reset.hidden = true;
    }


    /* ========================================================
       VER / OCULTAR ANÁLISIS
       ======================================================== */

    const toggle =
      result.querySelector(
        ".alfonso-analysis-toggle"
      );

    const details =
      result.querySelector(
        ".alfonso-analysis-details"
      );


    if (
      toggle &&
      details
    ) {

      toggle.addEventListener(
        "click",
        () => {

          const open =
            details.classList.toggle(
              "open"
            );


          toggle.classList.toggle(
            "open",
            open
          );


          toggle.setAttribute(
            "aria-expanded",
            String(open)
          );


          const label =
            toggle.querySelector(
              ".alfonso-analysis-toggle-content span:last-child"
            );


          if (label) {

            label.textContent =
              open
                ? "Ocultar análisis"
                : "Ver análisis completo";
          }

        }
      );
    }


    /* ========================================================
       ANALIZAR OTRA FACTURA
       ======================================================== */

    const newDocument =
      result.querySelector(
        "#alfonso-new-document"
      );


    if (newDocument) {

      newDocument.addEventListener(
        "click",
        resetDemo
      );
    }


    showResultArea();
  }


  /* ==========================================================
     11. PROCESAMIENTO
     ========================================================== */

  async function processFile(file) {

    if (!file) {
      return;
    }


    const allowedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "text/plain"
    ];


    const allowedExtension =
      /\.(pdf|png|jpe?g|txt)$/i;


    if (
      !allowedTypes.includes(file.type) &&
      !allowedExtension.test(file.name)
    ) {

      showError(
        "Selecciona un PDF, PNG, JPG o TXT."
      );

      return;
    }


    showLoading();


    const formData =
      new FormData();


    formData.append(
      "file",
      file,
      file.name
    );


    try {

      const response =
        await fetch(
          API_URL,
          {
            method: "POST",
            body: formData
          }
        );


      let data;


      try {

        data =
          await response.json();

      } catch {

        throw new Error(
          "El backend ha devuelto una respuesta no válida."
        );
      }


      if (!response.ok) {

        throw new Error(
          data?.detail ||
          data?.message ||
          "El servidor no ha podido procesar el documento."
        );
      }


      if (
        data &&
        data.success === false
      ) {

        throw new Error(
          data.message ||
          data.detail ||
          "El procesamiento no se ha completado."
        );
      }


      renderResult(data);


    } catch (error) {

      console.error(
        "Alfonso — invoice demo:",
        error
      );


      if (
        error instanceof TypeError
      ) {

        showError(
          "No se ha podido conectar con el backend de Alfonso. " +
          "Comprueba que el servicio de procesamiento está disponible."
        );

      } else {

        showError(
          error.message ||
          "Se ha producido un error durante el análisis."
        );
      }
    }
  }


  /* ==========================================================
     12. INPUT
     ========================================================== */

  fileInput.addEventListener(
    "change",
    async (event) => {

      const file =
        event.target.files?.[0];

      if (!file) {
        return;
      }

      await processFile(file);
    }
  );


  /* ==========================================================
     13. DRAG & DROP
     ========================================================== */

  if (uploadZone) {

    [
      "dragenter",
      "dragover"
    ].forEach(
      (eventName) => {

        uploadZone.addEventListener(
          eventName,
          (event) => {

            event.preventDefault();
            event.stopPropagation();

            uploadZone.classList.add(
              "dragover"
            );
          }
        );
      }
    );


    [
      "dragleave",
      "drop"
    ].forEach(
      (eventName) => {

        uploadZone.addEventListener(
          eventName,
          (event) => {

            event.preventDefault();
            event.stopPropagation();

            uploadZone.classList.remove(
              "dragover"
            );
          }
        );
      }
    );


    uploadZone.addEventListener(
      "drop",
      async (event) => {

        const file =
          event.dataTransfer
            ?.files?.[0];

        if (!file) {
          return;
        }

        await processFile(file);
      }
    );
  }


  /* ==========================================================
     14. RESET ORIGINAL
     ========================================================== */

  if (reset) {

    reset.addEventListener(
      "click",
      resetDemo
    );
  }

});