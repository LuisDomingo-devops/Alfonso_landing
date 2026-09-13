/**
 * ALFONSO GUIDE - Agente de Ventas y Guía Virtual Contextual
 * Experiencia de "Dependiente de Tienda" con IA Conversacional (Gemini / OpenRouter)
 * Cumple al 100% la política Zero-Cookies (identificador efímero en memoria).
 */

(function () {
  'use strict';

  // Mensajes y comentarios proactivos naturales según la zona de la web
  const PROACTIVE_MESSAGES = {
    'top': {
      title: 'Alfonso · Asesor',
      text: 'Muy buenas. Pregúntame lo que quieras, estoy aqui para lo que necesites.',
      action: 'Escribir a Alfonso →'
    },
    'producto': {
      title: 'Tickets y facturas',
      text: '¿Tienes facturas o tickets arrugados? Dime a qué te dedicas y te cuento cómo te los dejamos listos.',
      action: 'Preguntarle a Alfonso →'
    },
    'como-funciona': {
      title: 'Tú decides, Alfonso lo hace',
      text: 'Alfonso se encarga del trabajo pesado, pero tú siempre tienes la última palabra.',
      action: 'Comentar con Alfonso →'
    },
    'demo': {
      title: 'Prueba en directo',
      text: '¿Tienes una factura o un ticket a mano? Si quieres puedes probar a subirla en la demo para ver cómo la lee.',
      action: 'Saber más →'
    },
    'para-quien': {
      title: 'Adaptado a tu oficio',
      text: 'Tanto si eres electricista, programador o tienes un comercio, cuéntame tu caso y vemos cómo te ayuda.',
      action: 'Consultar mi caso →'
    },
    'calculadora': {
      title: 'Tu tiempo al mes',
      text: 'Un profesional suele recuperar entre 8 y 12 horas al mes de papeleo. ¿Quieres que calculemos tu caso?',
      action: 'Hacer el cálculo →'
    },
    'seguridad': {
      title: 'Sin líos con Hacienda',
      text: 'Alfonso prepara todo según la normativa Veri*Factu y colabora con tu gestor para que nadie pique datos a mano.',
      action: 'Preguntar sobre seguridad →'
    },
    'faq': {
      title: 'Dudas habituales',
      text: 'Si tienes cualquier pregunta que no veas aquí resuelta, pregúntamela directamente y te la aclaro en un segundo.',
      action: 'Preguntar en directo →'
    },
    'acceso': {
      title: 'Plazas de Beta Gratuita',
      text: 'Estamos abriendo 50 invitaciones gratuitas con soporte directo. ¿Quieres que te guarde una plaza?',
      action: 'Pedir invitación →'
    }
  };

  // Sugerencias sutiles opcionales de inspiración (no menús rígidos)
  const INSPIRATION_TOPICS = [
    '¿Cómo funciona con mi gestoría?',
    '¿Cumple con la ley Veri*Factu?',
    '¿Cómo solicito plaza en la Beta?'
  ];

  class AlfonsoGuide {
    constructor() {
      // Identificador de sesión efímero en memoria (Zero-Cookies / Zero-Tracking)
      this.sessionId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'session_' + Math.random().toString(36).substring(2, 11);

      this.isOpen = false;
      this.currentSection = 'top';
      this.history = [];
      this.hasInteracted = false;
      this.dismissedSections = new Set();
      this.bubbleTimer = null;
      this.isSubmitting = false;

      this.init();
    }

    init() {
      if (document.getElementById('alfonso-guide-root')) return;

      this.createDOM();
      this.bindEvents();
      this.initSectionObserver();

      // Saludo proactivo inicial a los 2 segundos
      setTimeout(() => {
        if (!this.isOpen && !this.hasInteracted && localStorage.getItem('alfonso_guide_dismissed') !== 'true') {
          this.showBubble('top');
        }
      }, 2000);
    }

    createDOM() {
      const root = document.createElement('div');
      root.id = 'alfonso-guide-root';
      root.setAttribute('aria-live', 'polite');

      root.innerHTML = `
        <div class="ag-trigger-wrap">
          <!-- Proactive Speech Bubble -->
          <div class="ag-speech-bubble" id="ag-speech-bubble" role="dialog" aria-label="Mensaje de Alfonso">
            <button class="ag-bubble-close" id="ag-bubble-close" type="button" aria-label="Cerrar sugerencia">✕</button>
            <div class="ag-bubble-header" id="ag-bubble-header">👔 ALFONSO · ASESOR</div>
            <div class="ag-bubble-text" id="ag-bubble-text">¡Hola! Pasa y mira con calma. Si quieres ver cómo te quitamos el lío de los tickets y las facturas, pregúntame lo que quieras.</div>
            <div class="ag-bubble-action" id="ag-bubble-action">Escribir a Alfonso →</div>
          </div>

          <!-- Trigger Button -->
          <button class="ag-trigger-btn" id="ag-trigger-btn" type="button" aria-label="Abrir asesor comercial Alfonso">
            <div class="ag-avatar-badge">
              <img class="ag-avatar-img" src="assets/Alfonso_AI_Konta_icon_512.png" alt="Alfonso" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
              <span class="ag-avatar-fallback" style="display:none;">👔</span>
              <span class="ag-status-pulse"></span>
              <span class="ag-status-dot"></span>
            </div>
            <div class="ag-trigger-label">
              <span class="ag-trigger-title">Alfonso <small style="color:#00f0ff;font-size:10px;">IA</small></span>
              <span class="ag-trigger-sub">Asesor de tienda</span>
            </div>
          </button>
        </div>

        <!-- Chat Window / Store Drawer -->
        <div class="ag-chat-window" id="ag-chat-window" role="dialog" aria-modal="true" aria-label="Conversación con Alfonso">
          <!-- Header -->
          <div class="ag-chat-header">
            <div class="ag-header-profile">
              <div class="ag-header-avatar">
                <img src="assets/Alfonso_AI_Konta_icon_512.png" alt="Alfonso" onerror="this.style.display='none';">
              </div>
              <div class="ag-header-info">
                <h4>Alfonso <span style="font-size:11px;color:#00f0ff;font-weight:600;">· Konta</span></h4>
                <p>En línea · Asesor en vivo</p>
              </div>
            </div>
            <div class="ag-header-controls">
              <button class="ag-control-btn" id="ag-close-btn" type="button" aria-label="Cerrar chat">✕</button>
            </div>
          </div>

          <!-- Messages -->
          <div class="ag-chat-messages" id="ag-chat-messages">
            <!-- Initial Welcome Message -->
            <div class="ag-message is-assistant">
              <div class="ag-msg-bubble">¡Hola, buenas! Soy Alfonso. Estoy por aquí para ayudarte a resolver cualquier duda sobre cómo gestionar tus facturas, impuestos o cómo colaborar con tu gestor. Cuéntame con total libertad: ¿a qué te dedicas o qué es lo que más tiempo te quita del papeleo?</div>
              <span class="ag-msg-time">Ahora</span>
            </div>

            <!-- Subtle Inspiration Chips (Optional inspiration, not a rigid menu) -->
            <div class="ag-inspiration-box" id="ag-inspiration-box">
              <span class="ag-inspiration-label">💡 Sugerencias de ejemplo:</span>
              <div class="ag-suggestions-wrap" id="ag-suggestions-wrap">
                ${INSPIRATION_TOPICS.map(t => `<button class="ag-suggestion-chip" type="button">${this.escapeHTML(t)}</button>`).join('')}
              </div>
            </div>
          </div>

          <!-- Footer / Input Form -->
          <div class="ag-chat-footer">
            <form class="ag-input-form" id="ag-input-form">
              <input 
                type="text" 
                class="ag-input-field" 
                id="ag-input-field" 
                placeholder="Escribe lo que quieras o cuéntame tu caso..." 
                autocomplete="off"
                maxlength="1000"
              >
              <button class="ag-send-btn" id="ag-send-btn" type="submit" aria-label="Enviar mensaje">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </form>
            <div class="ag-footer-note">
              <span>🔒 100% privado · Sin cookies</span>
              <span>⚡ Lenguaje natural con IA</span>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(root);

      this.elements = {
        bubble: document.getElementById('ag-speech-bubble'),
        bubbleClose: document.getElementById('ag-bubble-close'),
        bubbleHeader: document.getElementById('ag-bubble-header'),
        bubbleText: document.getElementById('ag-bubble-text'),
        bubbleAction: document.getElementById('ag-bubble-action'),
        triggerBtn: document.getElementById('ag-trigger-btn'),
        chatWindow: document.getElementById('ag-chat-window'),
        closeBtn: document.getElementById('ag-close-btn'),
        messagesContainer: document.getElementById('ag-chat-messages'),
        inspirationBox: document.getElementById('ag-inspiration-box'),
        suggestionsWrap: document.getElementById('ag-suggestions-wrap'),
        form: document.getElementById('ag-input-form'),
        input: document.getElementById('ag-input-field'),
        sendBtn: document.getElementById('ag-send-btn')
      };
    }

    bindEvents() {
      // Abrir/cerrar chat
      this.elements.triggerBtn.addEventListener('click', () => this.toggleChat());
      this.elements.closeBtn.addEventListener('click', () => this.closeChat());

      // Clic en la burbuja proactiva
      this.elements.bubble.addEventListener('click', (e) => {
        if (e.target === this.elements.bubbleClose) return;
        this.hideBubble();
        this.openChat();
      });

      this.elements.bubbleClose.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideBubble();
        this.dismissedSections.add(this.currentSection);
        localStorage.setItem('alfonso_guide_dismissed', 'true');
      });

      // Envío de formulario de chat
      this.elements.form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = this.elements.input.value.trim();
        if (text) {
          this.sendMessage(text);
          this.elements.input.value = '';
        }
      });

      // Ocultar sugerencias al empezar a escribir
      this.elements.input.addEventListener('input', () => {
        if (this.elements.input.value.trim().length > 0) {
          this.hideInspirationBox();
        }
      });

      // Clic en chips de sugerencia opcional
      if (this.elements.suggestionsWrap) {
        this.elements.suggestionsWrap.addEventListener('click', (e) => {
          const chip = e.target.closest('.ag-suggestion-chip');
          if (chip) {
            const query = chip.textContent.trim();
            this.sendMessage(query);
            this.hideInspirationBox();
          }
        });
      }

      // Tecla Escape para cerrar
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.closeChat();
        }
      });
    }

    hideInspirationBox() {
      if (this.elements.inspirationBox) {
        this.elements.inspirationBox.style.display = 'none';
      }
    }

    initSectionObserver() {
      const sectionSelectors = [
        { id: 'top', element: document.querySelector('.hero') || document.getElementById('top') },
        { id: 'producto', element: document.getElementById('producto') },
        { id: 'como-funciona', element: document.getElementById('como-funciona') },
        { id: 'demo', element: document.getElementById('demo') },
        { id: 'para-quien', element: document.getElementById('para-quien') },
        { id: 'funcionalidades', element: document.getElementById('funcionalidades') },
        { id: 'calculadora', element: document.getElementById('calculadora') },
        { id: 'seguridad', element: document.getElementById('seguridad') },
        { id: 'faq', element: document.getElementById('faq') },
        { id: 'acceso', element: document.getElementById('acceso') }
      ];

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.dataset.guideSection || entry.target.id || 'top';
            this.handleSectionChange(sectionId);
          }
        });
      }, {
        threshold: 0.35
      });

      sectionSelectors.forEach(item => {
        if (item.element) {
          item.element.dataset.guideSection = item.id;
          observer.observe(item.element);
        }
      });
    }

    handleSectionChange(sectionId) {
      if (this.currentSection === sectionId) return;
      this.currentSection = sectionId;

      clearTimeout(this.bubbleTimer);

      if (this.isOpen || this.dismissedSections.has(sectionId) || localStorage.getItem('alfonso_guide_dismissed') === 'true') {
        this.hideBubble();
        return;
      }

      // Mostrar burbuja tras 2.5 segundos de pausa en la sección
      this.bubbleTimer = setTimeout(() => {
        if (!this.isOpen && !this.dismissedSections.has(sectionId) && localStorage.getItem('alfonso_guide_dismissed') !== 'true') {
          this.showBubble(sectionId);
        }
      }, 2500);
    }

    showBubble(sectionId) {
      const config = PROACTIVE_MESSAGES[sectionId] || PROACTIVE_MESSAGES['top'];
      this.elements.bubbleHeader.textContent = config.title;
      this.elements.bubbleText.textContent = config.text;
      this.elements.bubbleAction.textContent = config.action;

      this.elements.bubble.classList.add('is-visible');
    }

    hideBubble() {
      this.elements.bubble.classList.remove('is-visible');
    }

    toggleChat() {
      if (this.isOpen) {
        this.closeChat();
      } else {
        this.openChat();
      }
    }

    openChat() {
      this.isOpen = true;
      this.hasInteracted = true;
      this.hideBubble();
      this.elements.chatWindow.classList.add('is-open');
      localStorage.removeItem('alfonso_guide_dismissed');

      setTimeout(() => {
        this.elements.input.focus();
        this.scrollToBottom();
      }, 200);
    }

    closeChat() {
      this.isOpen = false;
      this.elements.chatWindow.classList.remove('is-open');
      localStorage.setItem('alfonso_guide_dismissed', 'true');
    }

    async sendMessage(text) {
      if (this.isSubmitting) return;
      this.isSubmitting = true;

      this.hideInspirationBox();

      // Renderizar mensaje del usuario
      this.appendMessage('user', text);
      this.history.push({ role: 'user', text });

      // Renderizar indicador de escritura
      const typingEl = this.showTyping();
      this.elements.sendBtn.disabled = true;

      // Comprobar comandos de navegación visual (Spotlight)
      this.checkSpotlightTriggers(text);

      try {
        const res = await fetch('/api/guide/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            history: this.history.slice(-8),
            section: '#' + this.currentSection,
            sessionId: this.sessionId
          })
        });

        const data = await res.json();
        this.removeTyping(typingEl);

        if (res.ok && data?.data?.response) {
          const assistantText = data.data.response;
          this.appendMessage('assistant', assistantText);
          this.history.push({ role: 'assistant', text: assistantText });

          // Si se capturó un lead (email), mostrar confirmación discreta
          if (data.data.leadCaptured && data.data.leadEmail) {
            this.appendLeadConfirmation(data.data.leadEmail);
          }
        } else {
          this.appendMessage('assistant', 'Disculpa, se ha producido un pequeño corte en la comunicación. Si quieres que te guardemos plaza en la Beta o tienes cualquier duda, déjame tu correo por aquí y te responderemos enseguida.');
        }
      } catch (err) {
        console.error('Error enviando mensaje al guía:', err);
        this.removeTyping(typingEl);
        this.appendMessage('assistant', 'Gracias por tu consulta. Si quieres que te guardemos una invitación para la Beta privada gratuita, puedes dejarme tu correo aquí o inscribirte en el formulario de la página.');
      } finally {
        this.isSubmitting = false;
        this.elements.sendBtn.disabled = false;
        this.elements.input.focus();
      }
    }

    appendMessage(role, text) {
      const msgDiv = document.createElement('div');
      msgDiv.className = `ag-message is-${role}`;

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      msgDiv.innerHTML = `
        <div class="ag-msg-bubble">${this.escapeHTML(text)}</div>
        <span class="ag-msg-time">${timeStr}</span>
      `;

      this.elements.messagesContainer.appendChild(msgDiv);
      this.scrollToBottom();
    }

    appendLeadConfirmation(email) {
      const badge = document.createElement('div');
      badge.className = 'ag-lead-confirmed';
      badge.innerHTML = `
        <span style="font-size:16px;">🎉</span>
        <div>
          <strong>¡Plaza reservada con éxito!</strong><br>
          <small>Invitación registrada para <b>${this.escapeHTML(email)}</b>.</small>
        </div>
      `;
      this.elements.messagesContainer.appendChild(badge);
      this.scrollToBottom();
    }

    showTyping() {
      const el = document.createElement('div');
      el.className = 'ag-typing-indicator';
      el.innerHTML = `
        <span class="ag-typing-dot"></span>
        <span class="ag-typing-dot"></span>
        <span class="ag-typing-dot"></span>
      `;
      this.elements.messagesContainer.appendChild(el);
      this.scrollToBottom();
      return el;
    }

    removeTyping(el) {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }

    scrollToBottom() {
      this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    }

    checkSpotlightTriggers(text) {
      const lower = text.toLowerCase();
      let targetId = null;

      if (lower.includes('calculadora') || lower.includes('ahorro') || lower.includes('horas')) {
        targetId = 'calculadora';
      } else if (lower.includes('demo') || lower.includes('probar factura') || lower.includes('subir')) {
        targetId = 'demo';
      } else if (lower.includes('beta') || lower.includes('inscribir') || lower.includes('formulario') || lower.includes('apuntar')) {
        targetId = 'acceso';
      } else if (lower.includes('seguridad') || lower.includes('privacidad') || lower.includes('verifactu')) {
        targetId = 'seguridad';
      }

      if (targetId) {
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetEl.classList.add('alfonso-spotlight-active');
          setTimeout(() => {
            targetEl.classList.remove('alfonso-spotlight-active');
          }, 3500);
        }
      }
    }

    escapeHTML(str) {
      const p = document.createElement('p');
      p.textContent = str;
      return p.innerHTML;
    }
  }

  // Inicializar de forma segura cuando el DOM esté listo
  if (typeof global !== 'undefined' && global.__TEST_ENV__) {
    global.AlfonsoGuide = AlfonsoGuide;
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new AlfonsoGuide());
  } else {
    new AlfonsoGuide();
  }
})();
