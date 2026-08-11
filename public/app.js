document.addEventListener("DOMContentLoaded", () => {

  /* =========================================================
     MOBILE NAVIGATION
     ========================================================= */

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

    nav.querySelectorAll("a").forEach(link => {

      link.addEventListener("click", () => {

        nav.classList.remove("open");

        menu.setAttribute(
          "aria-expanded",
          "false"
        );

      });

    });

  }


  /* =========================================================
     LOCAL DEMO
     ========================================================= */

  const uploadZone =
    document.getElementById("upload-zone");

  const fileInput =
    document.getElementById("file-input");

  const result =
    document.getElementById("demo-result");

  const reset =
    document.getElementById("reset-demo");


  function formatBytes(bytes) {

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  }


  function escapeHtml(value) {

    return String(value).replace(
      /[&<>"']/g,
      char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[char])
    );

  }


  function showFile(file) {

    if (!file || !result) {
      return;
    }


    const allowed = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "text/plain"
    ];


    const validExtension =
      /\.(pdf|png|jpe?g|txt)$/i.test(
        file.name
      );


    if (
      !allowed.includes(file.type) &&
      !validExtension
    ) {

      result.hidden = false;

      result.innerHTML = `
        <strong>Formato no compatible.</strong><br>
        Selecciona un PDF, PNG, JPG o TXT.
      `;

      if (reset) {
        reset.hidden = false;
      }

      return;

    }


    const now =
      new Date().toLocaleTimeString(
        "es-ES",
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      );


    result.hidden = false;

    result.innerHTML = `
      <strong>Documento recibido.</strong><br>
      Archivo: ${escapeHtml(file.name)}<br>
      Tamaño: ${formatBytes(file.size)}
      · Tipo: ${escapeHtml(file.type || "desconocido")}<br>

      <span style="color:#67e1b2">
        ✓ Demo local completada a las ${now}.
      </span>

      <br>

      <small>
        En esta demo no se envía el archivo a un servidor
        ni se afirma que se haya realizado OCR fiscal real.
      </small>
    `;


    if (reset) {
      reset.hidden = false;
    }

  }


  if (fileInput) {

    fileInput.addEventListener(
      "change",
      event => {

        showFile(
          event.target.files[0]
        );

      }
    );

  }


  if (uploadZone) {

    ["dragenter", "dragover"].forEach(
      eventName => {

        uploadZone.addEventListener(
          eventName,
          event => {

            event.preventDefault();

            uploadZone.classList.add(
              "dragover"
            );

          }
        );

      }
    );


    ["dragleave", "drop"].forEach(
      eventName => {

        uploadZone.addEventListener(
          eventName,
          event => {

            event.preventDefault();

            uploadZone.classList.remove(
              "dragover"
            );

          }
        );

      }
    );


    uploadZone.addEventListener(
      "drop",
      event => {

        const file =
          event.dataTransfer.files?.[0];

        if (file) {
          showFile(file);
        }

      }
    );

  }


  if (reset) {

    reset.addEventListener(
      "click",
      () => {

        if (fileInput) {
          fileInput.value = "";
        }

        if (result) {
          result.hidden = true;
          result.innerHTML = "";
        }

        reset.hidden = true;

      }
    );

  }


  /* =========================================================
     PREMIUM TIME-VALUE CALCULATOR
     ========================================================= */

  const hoursInput =
    document.getElementById(
      "hoursInput"
    );

  const hourValueInput =
    document.getElementById(
      "hourValueInput"
    );

  const hoursOutput =
    document.getElementById(
      "hoursOutput"
    );

  const hourValueOutput =
    document.getElementById(
      "hourValueOutput"
    );

  const monthlySaving =
    document.getElementById(
      "monthlySaving"
    );

  const annualSaving =
    document.getElementById(
      "annualSaving"
    );

  const savedHours =
    document.getElementById(
      "savedHours"
    );

  const timeValue =
    document.getElementById(
      "timeValue"
    );


  function euro(value) {

    return new Intl.NumberFormat(
      "es-ES",
      {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0
      }
    ).format(value);

  }


  function updatePremiumCalculator() {

    if (
      !hoursInput ||
      !hourValueInput
    ) {
      return;
    }


    const hours =
      Number(hoursInput.value);

    const hourlyValue =
      Number(hourValueInput.value);

    const monthly =
      hours * hourlyValue;

    const annual =
      monthly * 12;


    if (hoursOutput) {
      hoursOutput.textContent =
        `${hours} h`;
    }


    if (hourValueOutput) {
      hourValueOutput.textContent =
        `${hourlyValue} €/h`;
    }


    if (monthlySaving) {
      monthlySaving.textContent =
        euro(monthly);
    }


    if (annualSaving) {
      annualSaving.textContent =
        euro(annual);
    }


    if (savedHours) {
      savedHours.textContent =
        `${hours} h/mes`;
    }


    if (timeValue) {
      timeValue.textContent =
        `${hourlyValue} €/h`;
    }


    [hoursInput, hourValueInput]
      .forEach(input => {

        const min =
          Number(input.min);

        const max =
          Number(input.max);

        const value =
          Number(input.value);

        const progress =
          ((value - min) / (max - min)) * 100;

        input.style.setProperty(
          "--range-progress",
          `${progress}%`
        );

      });

  }


  [hoursInput, hourValueInput]
    .forEach(input => {

      if (input) {

        input.addEventListener(
          "input",
          updatePremiumCalculator
        );

      }

    });


  updatePremiumCalculator();


  /* =========================================================
     VERI*FACTU ORIENTATION
     ========================================================= */

  const veriFactuForm =
    document.getElementById(
      "verifactu-quiz-form"
    );

  const veriFactuResults =
    document.getElementById(
      "verifactu-results"
    );


  if (
    veriFactuForm &&
    veriFactuResults
  ) {

    veriFactuForm.addEventListener(
      "submit",
      event => {

        event.preventDefault();


        const q1 =
          Number(
            document.getElementById(
              "q1"
            )?.value || 0
          );


        const q2 =
          Number(
            document.getElementById(
              "q2"
            )?.value || 0
          );


        const q3 =
          Number(
            document.getElementById(
              "q3"
            )?.value || 0
          );


        const q4 =
          Number(
            document.getElementById(
              "q4"
            )?.value || 0
          );


        const emailInput =
          document.getElementById(
            "verifactu-email"
          );


        const email =
          emailInput?.value.trim() || "";


        const total =
          q1 + q2 + q3 + q4;


        const badge =
          document.getElementById(
            "verifactu-badge"
          );

        const title =
          document.getElementById(
            "verifactu-title"
          );

        const description =
          document.getElementById(
            "verifactu-desc"
          );

        const userEmail =
          document.getElementById(
            "verifactu-user-email"
          );


        if (total >= 6) {

          badge.textContent =
            "ORIENTACIÓN · AVANZADA";

          badge.style.background =
            "rgba(34,197,139,.12)";

          badge.style.color =
            "#67e1b2";

          title.textContent =
            "Tu sistema parece bien encaminado.";

          description.textContent =
            "Tus respuestas indican un nivel de preparación avanzado. " +
            "Aun así, esta orientación no certifica el cumplimiento normativo.";

        }

        else if (total >= 3) {

          badge.textContent =
            "ORIENTACIÓN · REVISAR";

          badge.style.background =
            "rgba(255,181,27,.12)";

          badge.style.color =
            "#ffc84d";

          title.textContent =
            "Hay aspectos que deberías revisar.";

          description.textContent =
            "Tus respuestas muestran algunos elementos que conviene comprobar " +
            "con tu proveedor de facturación o asesor.";

        }

        else {

          badge.textContent =
            "ORIENTACIÓN · PENDIENTE";

          badge.style.background =
            "rgba(255,100,100,.12)";

          badge.style.color =
            "#ff9a9a";

          title.textContent =
            "Conviene revisar tu sistema.";

          description.textContent =
            "Tus respuestas no permiten asumir que tu sistema esté preparado. " +
            "Te recomendamos contrastar la situación con tu proveedor o asesor.";

        }


        if (userEmail) {
          userEmail.textContent =
            email;
        }


        veriFactuForm.hidden = true;
        veriFactuResults.hidden = false;

      }
    );

  }


  /* =========================================================
     WAITLIST
     ========================================================= */

  const form =
    document.getElementById(
      "waitlist-form"
    );

  const email =
    document.getElementById(
      "email"
    );

  const message =
    document.getElementById(
      "form-message"
    );


  if (form) {

    form.addEventListener(
      "submit",
      event => {

        event.preventDefault();


        const value =
          email?.value.trim() || "";


        if (
          !value ||
          !email.checkValidity()
        ) {

          if (message) {

            message.textContent =
              "Introduce un email válido.";

            message.style.color =
              "#ff8a8a";

          }

          return;

        }


        if (message) {

          message.textContent =
            "¡Gracias! Hemos recibido tu solicitud para participar en la beta.";

          message.style.color =
            "#67e1b2";

        }


        form.reset();

      }
    );

  }

});