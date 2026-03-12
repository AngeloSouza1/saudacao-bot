    const els = {
      statusBadge: document.getElementById("status-badge"),
      statusLines: document.getElementById("status-lines"),
      actionLog: document.getElementById("action-log"),
      nextGreetings: document.getElementById("next-greetings"),
      agenda: document.getElementById("agenda"),
      lastRun: document.getElementById("last-run"),
      to: document.getElementById("to"),
      groupId: document.getElementById("groupId"),
      groupName: document.getElementById("groupName"),
      groupSelect: document.getElementById("groupSelect"),
      turma: document.getElementById("turma"),
      instituicao: document.getElementById("instituicao"),
      antecedenciaMin: document.getElementById("antecedenciaMin"),
      diasUteisApenas: document.getElementById("diasUteisApenas"),
      lockPassword: document.getElementById("lockPassword"),
      lockTimeoutMin: document.getElementById("lockTimeoutMin"),
      startAluno: document.getElementById("startAluno"),
      startAula: document.getElementById("startAula"),
      startDate: document.getElementById("startDate"),
      cycleInfo: document.getElementById("cycle-info"),
      cycleHistory: document.getElementById("cycle-history"),
      heroCycle: document.getElementById("hero-cycle")
    };
    const modalEls = {
      wrap: document.getElementById("editor-modal"),
      studentName: document.getElementById("modal-student-name"),
      students: document.getElementById("modal-students"),
      dia: document.getElementById("modal-dia"),
      hora: document.getElementById("modal-hora"),
      titulo: document.getElementById("modal-titulo"),
      materia: document.getElementById("modal-materia"),
      professor: document.getElementById("modal-professor"),
      lessons: document.getElementById("modal-lessons")
    };
    const confirmEls = {
      wrap: document.getElementById("confirm-modal"),
      title: document.getElementById("confirm-title"),
      text: document.getElementById("confirm-text"),
      cancel: document.getElementById("confirm-cancel"),
      ok: document.getElementById("confirm-ok")
    };
    const newCycleEls = {
      wrap: document.getElementById("new-cycle-modal"),
      name: document.getElementById("new-cycle-name"),
      cancel: document.getElementById("new-cycle-cancel"),
      confirm: document.getElementById("new-cycle-confirm")
    };
    const infoEls = {
      wrap: document.getElementById("info-modal"),
      title: document.getElementById("info-title"),
      text: document.getElementById("info-text"),
      ok: document.getElementById("info-ok")
    };
    const swapEls = {
      wrap: document.getElementById("swap-modal"),
      from: document.getElementById("swap-from"),
      to: document.getElementById("swap-to"),
      cancel: document.getElementById("swap-cancel"),
      confirm: document.getElementById("swap-confirm")
    };
    const effectiveFixEls = {
      wrap: document.getElementById("effective-fix-modal"),
      expected: document.getElementById("effective-fix-expected"),
      performer: document.getElementById("effective-fix-performer"),
      cancel: document.getElementById("effective-fix-cancel"),
      confirm: document.getElementById("effective-fix-confirm")
    };
    const agendaViewEls = {
      openBtn: document.getElementById("btn-open-full-agenda"),
      wrap: document.getElementById("agenda-modal"),
      list: document.getElementById("agenda-modal-list"),
      closeBtn: document.getElementById("btn-close-agenda-modal")
    };
    const cyclesViewEls = {
      wrap: document.getElementById("cycles-modal"),
      list: document.getElementById("cycles-modal-list"),
      closeBtn: document.getElementById("btn-close-cycles-modal"),
      filter: document.getElementById("cycles-filter")
    };
    const cardViewEls = {
      destination: {
        openBtn: document.getElementById("btn-open-destination-modal"),
        wrap: document.getElementById("destination-card-modal"),
        closeBtn: document.getElementById("btn-close-destination-modal")
      },
      config: {
        openBtn: document.getElementById("btn-open-config-modal"),
        wrap: document.getElementById("config-card-modal"),
        closeBtn: document.getElementById("btn-close-config-modal")
      },
      agenda: {
        openBtn: document.getElementById("btn-open-agenda-card-modal"),
        wrap: document.getElementById("agenda-card-modal"),
        closeBtn: document.getElementById("btn-close-agenda-card-modal")
      }
    };
    const loadingEl = document.getElementById("app-loading");
    const loadingTitleEl = document.getElementById("app-loading-title");
    const loadingTextEl = document.getElementById("app-loading-text");
    const loadingChecklistEl = document.getElementById("app-loading-checklist");
    const waLoginOverlayEl = document.getElementById("wa-login-overlay");
    const waLoginTextEl = document.getElementById("wa-login-text");
    const waLoginQrEl = document.getElementById("wa-login-qr");
    const waLoginEmptyEl = document.getElementById("wa-login-empty");
    const waLoginFeedbackEl = document.getElementById("wa-login-feedback");
    const qrConnectOverlayEl = document.getElementById("qr-connect-overlay");
    const qrConnectTextEl = document.getElementById("qr-connect-text");
    const btnWaReconnect = document.getElementById("btn-wa-reconnect");
    const btnLockNow = document.getElementById("btn-lock-now");
    const lockOverlayEl = document.getElementById("lock-overlay");
    const lockTextEl = document.getElementById("lock-text");
    const lockInputEl = document.getElementById("lock-unlock-password");
    const lockFeedbackEl = document.getElementById("lock-feedback");
    const btnUnlock = document.getElementById("btn-unlock");
    const MIN_APP_LOADING_MS = 3000;
    const MAX_APP_LOADING_MS = 20000;
    let appLoadingStartedAt = Date.now();
    let appLoadingHideTimer = null;
    let initialStatusLoaded = false;
    let initialGroupsLoaded = false;
    let latestStatusData = null;
    let isRefreshing = false;
    let isLoadingGroups = false;
    let isManualSendBusy = false;
    let refreshLoopTimer = null;
    let lockConfigured = false;
    let isScreenLocked = false;
    let autoLockTimer = null;
    let lockTimeoutMs = 15 * 60 * 1000;
    let lastUserActivityAt = Date.now();
    let qrConnectTimer = null;
    let lastWaPhaseForOverlay = "";
    let easyAgendaRows = [];
    let modalData = { alunos: [], lessons: [] };
    let currentScheduleItems = [];
    let editingLessonIndex = -1;
    let editingStudentIndex = -1;
    let confirmResolver = null;
    let appReadyShown = false;
    let destinationSnapshot = { to: "", groupId: "", groupName: "" };
    let configSnapshot = {
      turma: "",
      instituicao: "",
      antecedenciaMin: "0",
      diasUteisApenas: "true",
      lockTimeoutMin: "15"
    };
    let agendaPendingRowsCache = [];
    let swapTargetPendingIndex = -1;
    let swapFromAluno = "";
    let effectiveFixContext = { index: -1, itemKey: "", alunoPrevisto: "" };
    const AUTO_FOCUS_INVALID_FIELD = false;
    const DEBUG_LESSON_FLOW = true;
    const btnAddStudent = document.getElementById("btn-add-student");
    const btnSaveStudentEdit = document.getElementById("btn-save-student-edit");
    const btnAddLesson = document.getElementById("btn-add-lesson");
    const btnSaveLessonEdit = document.getElementById("btn-save-lesson-edit");
    const btnCancelLessonEdit = document.getElementById("btn-cancel-lesson-edit");
    const btnSaveDestination = document.getElementById("btn-save-destination");
    const btnSaveConfig = document.getElementById("btn-save-config");
    const btnNewCycle = document.getElementById("btn-new-cycle");
    const btnCancelCycle = document.getElementById("btn-cancel-cycle");
    const btnRefreshCyclePending = document.getElementById("btn-refresh-cycle-pending");
    const btnSaveStartAluno = document.getElementById("btn-save-start-aluno");
    const btnSaveStartAula = document.getElementById("btn-save-start-aula");
    const btnSaveStartDate = document.getElementById("btn-save-start-date");
    let agendaItemsCache = [];
    let cycleHistoryCache = [];
    let startSnapshot = { idxAluno: "", idxAula: "", dataInicio: "" };
    if (btnSaveDestination) btnSaveDestination.disabled = true;
    if (btnSaveConfig) btnSaveConfig.disabled = true;
    if (btnCancelCycle) btnCancelCycle.disabled = true;
    if (btnAddStudent) btnAddStudent.disabled = true;
    if (btnAddLesson) btnAddLesson.disabled = true;
    if (btnSaveStartAluno) btnSaveStartAluno.disabled = true;
    if (btnSaveStartAula) btnSaveStartAula.disabled = true;
    if (btnSaveStartDate) btnSaveStartDate.disabled = true;

    function inferLogType(text, isError) {
      if (isError) return "danger";
      const value = String(text || "").toLowerCase();
      if (!value) return "info";
      if (
        value.includes("carregando") ||
        value.includes("salvando") ||
        value.includes("enviando") ||
        value.includes("atualizando") ||
        value.includes("aguardando") ||
        value.includes("solicitando") ||
        value.includes("inicializando")
      ) {
        return "info";
      }
      return "success";
    }

    function formatLogTime(date = new Date()) {
      return date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    }

    function setLog(text, isError) {
      const message = String(text || "").trim();
      const type = inferLogType(message, isError);
      els.actionLog.className = "log" + (type ? " " + type : "");
      if (!message) {
        els.actionLog.textContent = "";
        return;
      }
      els.actionLog.innerHTML =
        '<span class="log-time">[' + formatLogTime() + ']</span> ' +
        escapeHtml(message);
    }

    function setButtonBusy(button, busy) {
      if (!button) return;
      button.classList.toggle("is-busy", Boolean(busy));
      if (busy) {
        button.setAttribute("aria-busy", "true");
      } else {
        button.removeAttribute("aria-busy");
      }
    }

    async function runWithBusyButton(button, task) {
      setButtonBusy(button, true);
      try {
        return await task();
      } finally {
        setButtonBusy(button, false);
      }
    }

    function updateManualSendButtonsState() {
      const hasActiveCycle = Boolean(latestStatusData?.cycle?.active);
      const enabled = hasActiveCycle && !isManualSendBusy;
      const btnNow = document.getElementById("btn-now");
      const btnNowForced = document.getElementById("btn-now-forced");
      const btnNowMobile = document.getElementById("m-btn-now");
      const btnNowForcedMobile = document.getElementById("m-btn-now-forced");
      if (btnNow) btnNow.disabled = !enabled;
      if (btnNowForced) btnNowForced.disabled = !enabled;
      if (btnNowMobile) btnNowMobile.disabled = !enabled;
      if (btnNowForcedMobile) btnNowForcedMobile.disabled = !enabled;
    }

    function onById(id, event, handler) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener(event, handler);
    }

    function pad2(value) {
      return String(value).padStart(2, "0");
    }

    function parseDateOnly(value) {
      const raw = String(value || "").trim();
      let year;
      let month;
      let day;

      const isDigits = (text) => {
        if (!text) return false;
        for (const ch of String(text)) {
          if (ch < "0" || ch > "9") return false;
        }
        return true;
      };

      if (raw.length === 10 && raw[4] === "-" && raw[7] === "-") {
        const y = raw.slice(0, 4);
        const m = raw.slice(5, 7);
        const d = raw.slice(8, 10);
        if (!isDigits(y) || !isDigits(m) || !isDigits(d)) return null;
        year = Number(y);
        month = Number(m);
        day = Number(d);
      } else if (raw.length === 10 && raw[2] === "/" && raw[5] === "/") {
        const d = raw.slice(0, 2);
        const m = raw.slice(3, 5);
        const y = raw.slice(6, 10);
        if (!isDigits(y) || !isDigits(m) || !isDigits(d)) return null;
        year = Number(y);
        month = Number(m);
        day = Number(d);
      } else {
        return null;
      }

      const date = new Date(year, month - 1, day, 0, 0, 0, 0);
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        return null;
      }
      return date;
    }

    function toIsoDateOnly(date) {
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
      return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
      ].join("-");
    }

    function applyTimeOnDate(baseDate, horario) {
      const time = String(horario || "").trim();
      const parts = time.split(":");
      const hours = Number(parts[0]);
      const minutes = Number(parts[1]);
      if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
      const date = new Date(baseDate);
      date.setHours(hours, minutes, 0, 0);
      return date;
    }

    function computeNextScheduledDate(dia, horario, referenceDate) {
      const weekday = Number(dia);
      const time = String(horario || "").trim();
      const parts = time.split(":");
      const hours = Number(parts[0]);
      const minutes = Number(parts[1]);

      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;
      if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

      const base = referenceDate instanceof Date ? referenceDate : new Date();
      const candidate = new Date(base);
      candidate.setHours(hours, minutes, 0, 0);

      const diffDays = (weekday - candidate.getDay() + 7) % 7;
      candidate.setDate(candidate.getDate() + diffDays);

      if (diffDays === 0 && candidate < base) {
        candidate.setDate(candidate.getDate() + 7);
      }
      return candidate;
    }

    function formatDatePtBr(date) {
      if (!date) return null;
      return pad2(date.getDate()) + "/" + pad2(date.getMonth() + 1) + "/" + date.getFullYear();
    }

    function formatDateTimePtBr(value) {
      if (!value) return "-";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "-";
      return date.toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
      });
    }

    function formatCycleLine(cycle) {
      const sent = Number(cycle?.sentCount || 0);
      const total = Number(cycle?.totalAlunos || 0);
      const inicio = cycle?.start?.dataInicio || "-";
      const criadoEm = formatDateTimePtBr(cycle?.createdAt);
      const concluidoEm = cycle?.completedAt ? formatDateTimePtBr(cycle.completedAt) : "-";
      const title = String(cycle?.status || "") === "active" ? "Ativo" : "Concluído";
      const cancelado = Boolean(cycle?.canceled);
      const name = String(cycle?.name || "").trim();
      return (
        "<b>" + title + "</b>" +
        (name ? " | Nome: " + escapeHtml(name) : "") +
        (cancelado ? " (cancelado)" : "") +
        " | Início: " + inicio +
        " | Progresso: " + sent + "/" + total +
        " | Criado: " + criadoEm +
        (title === "Concluído" ? " | Finalizado: " + concluidoEm : "")
      );
    }

    function renderCycleHistorySummary() {
      if (!cycleHistoryCache.length) {
        els.cycleHistory.innerHTML = '<div class="muted-small">Sem histórico de ciclos.</div>';
        return;
      }

      const btnHtml = '<button id="btn-open-cycles-modal" class="secondary">Ver todos os ciclos</button>';

      els.cycleHistory.innerHTML =
        '<div class="cycle-history-head">' +
          '<h3 class="cycle-history-title">Histórico de ciclos</h3>' +
          btnHtml +
        "</div>" +
        '<div class="muted-small">Clique no botão para visualizar o histórico completo.</div>';

      const openBtn = document.getElementById("btn-open-cycles-modal");
      if (openBtn) {
        openBtn.addEventListener("click", () => {
          openCyclesModal();
        });
      }
    }

    function renderCyclesModal() {
      const filter = String(cyclesViewEls.filter?.value || "all");
      const filtered = cycleHistoryCache.filter((cycle) => {
        const status = String(cycle?.status || "completed");
        if (filter === "active") return status === "active";
        if (filter === "completed") return status === "completed";
        return true;
      });

      if (!filtered.length) {
        cyclesViewEls.list.innerHTML = '<div class="muted-small">Nenhum ciclo para o filtro selecionado.</div>';
        return;
      }

      const items = filtered.map((cycle) => {
        const status = String(cycle?.status || "completed");
        const className = "cycle-history-item " + (status === "active" ? "active" : "completed");
        return '<li class="' + className + '">' + formatCycleLine(cycle) + "</li>";
      }).join("");

      cyclesViewEls.list.innerHTML = '<ul class="cycle-history-list">' + items + "</ul>";
    }

    function openCyclesModal() {
      renderCyclesModal();
      cyclesViewEls.wrap.classList.add("open");
      cyclesViewEls.wrap.setAttribute("aria-hidden", "false");
    }

    function closeCyclesModal() {
      cyclesViewEls.wrap.classList.remove("open");
      cyclesViewEls.wrap.setAttribute("aria-hidden", "true");
    }

    function openCardModal(wrap) {
      if (!wrap) return;
      wrap.classList.add("open");
      wrap.setAttribute("aria-hidden", "false");
    }

    function closeCardModal(wrap) {
      if (!wrap) return;
      wrap.classList.remove("open");
      wrap.setAttribute("aria-hidden", "true");
    }

    function bindCardAccessModals() {
      Object.values(cardViewEls).forEach(({ openBtn, closeBtn, wrap }) => {
        if (!wrap) return;
        if (openBtn) {
          openBtn.addEventListener("click", () => {
            openCardModal(wrap);
          });
        }
        if (closeBtn) {
          closeBtn.addEventListener("click", () => {
            closeCardModal(wrap);
          });
        }
        wrap.addEventListener("click", (event) => {
          if (event.target === wrap) {
            closeCardModal(wrap);
          }
        });
      });
    }

    function capitalizeFirst(text) {
      const value = String(text || "");
      if (!value) return value;
      return value.charAt(0).toUpperCase() + value.slice(1);
    }

    function formatAgendaItem(item) {
      const diaLabelLongo = {
        "0": "domingo",
        "1": "segunda-feira",
        "2": "terça-feira",
        "3": "quarta-feira",
        "4": "quinta-feira",
        "5": "sexta-feira",
        "6": "sábado"
      };
      const diaNominal = capitalizeFirst(diaLabelLongo[String(item.dia)] || "dia não definido");
      let nextDate = null;
      if (item.scheduledDateISO) {
        const parsed = new Date(item.scheduledDateISO);
        if (!Number.isNaN(parsed.getTime())) {
          nextDate = parsed;
        }
      }
      if (!nextDate && item.scheduledDate instanceof Date) {
        nextDate = item.scheduledDate;
      }
      if (!nextDate) {
        nextDate = computeNextScheduledDate(item.dia, item.horario);
      }
      const nextDateLabel = formatDatePtBr(nextDate);
      const titulo = String(item.titulo || "").trim();
      const tituloPart = titulo ? " | Título: " + titulo : "";
      return (
        diaNominal +
        (nextDateLabel ? " (" + nextDateLabel + ")" : "") +
        " às " + item.horario +
        tituloPart +
        " | " + item.materia +
        " | " + item.professor +
        " | Próximo aluno: " + item.alunoPrevisto
      );
    }

    function resolveAgendaItemDate(item) {
      if (item?.scheduledDateISO) {
        const parsed = new Date(item.scheduledDateISO);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
      if (item?.scheduledDate instanceof Date && !Number.isNaN(item.scheduledDate.getTime())) {
        return item.scheduledDate;
      }
      return null;
    }

    function getGreetingPriority(item) {
      const itemDate = resolveAgendaItemDate(item);
      if (itemDate && isSameLocalDay(itemDate, new Date())) {
        return { label: "Hoje", className: "today" };
      }
      return { label: "Próxima", className: "upcoming" };
    }

    function formatNextGreetingItem(item) {
      const priority = getGreetingPriority(item);
      const title = String(item?.alunoPrevisto || "").trim() || "Aluno não definido";
      return (
        '<li class="' + (priority.className === "today" ? "today" : "") + '">' +
          '<div class="greeting-item-head">' +
            '<span class="greeting-item-title">' + escapeHtml(title) + '</span>' +
            '<span class="priority-badge ' + priority.className + '">' + priority.label + '</span>' +
          '</div>' +
          '<div class="greeting-item-body">' + escapeHtml(formatAgendaItem(item)) + '</div>' +
        '</li>'
      );
    }

    function buildAgendaItemKey(item) {
      const cycleId = String(latestStatusData?.cycle?.active?.id || "no-cycle");
      return [
        cycleId,
        String(item?.scheduledDateISO || ""),
        String(item?.materia || ""),
        String(item?.professor || ""),
        String(item?.horario || "")
      ].join("|");
    }

    function isAgendaItemDone(item, index, doneCount, now, revertedSet) {
      const key = buildAgendaItemKey(item);
      if (revertedSet.has(key)) return false;
      if (Boolean(item?.manualEfetivado)) return true;
      return false;
    }

    function isSameLocalDay(left, right) {
      if (!(left instanceof Date) || Number.isNaN(left.getTime())) return false;
      if (!(right instanceof Date) || Number.isNaN(right.getTime())) return false;
      return (
        left.getFullYear() === right.getFullYear() &&
        left.getMonth() === right.getMonth() &&
        left.getDate() === right.getDate()
      );
    }

    function renderAgendaPreview(items) {
      agendaItemsCache = items;
      const revertedSet = new Set(
        Array.isArray(latestStatusData?.state?.revertidosEfetivados)
          ? latestStatusData.state.revertidosEfetivados.map((item) => String(item || ""))
          : []
      );
      const pendingItems = items.filter((item, index) => {
        return !isAgendaItemDone(item, index, 0, 0, revertedSet);
      });

      const preview = pendingItems.slice(0, 3).map((item) => "<li>" + formatAgendaItem(item) + "</li>").join("");
      els.agenda.setAttribute("aria-busy", "false");
      els.agenda.innerHTML = preview ? "<ul>" + preview + "</ul>" : '<div class="muted-small">Sem agendamentos pendentes.</div>';
      // Mantém o acesso ao modal completo sempre visível.
      agendaViewEls.openBtn.classList.remove("is-hidden");
    }

    function renderNextGreetings(items) {
      const revertedSet = new Set(
        Array.isArray(latestStatusData?.state?.revertidosEfetivados)
          ? latestStatusData.state.revertidosEfetivados.map((item) => String(item || ""))
          : []
      );

      const pendingItems = items.filter((item, index) =>
        !isAgendaItemDone(item, index, 0, 0, revertedSet)
      );
      const list = pendingItems.slice(0, 8).map((item) => formatNextGreetingItem(item)).join("");
      els.nextGreetings.setAttribute("aria-busy", "false");
      els.nextGreetings.innerHTML = list ? "<ul>" + list + "</ul>" : '<div class="muted-small">Sem próximas saudações pendentes.</div>';
    }

    function renderAgendaModal() {
      const linkedOrder = Array.isArray(latestStatusData?.state?.ordemVinculadaCiclo)
        ? latestStatusData.state.ordemVinculadaCiclo.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      const linkedSet = new Set(linkedOrder);
      const revertedSet = new Set(
        Array.isArray(latestStatusData?.state?.revertidosEfetivados)
          ? latestStatusData.state.revertidosEfetivados.map((item) => String(item || ""))
          : []
      );
      let pendingIndex = 0;
      agendaPendingRowsCache = [];
      const orderedRows = [];

      agendaItemsCache.forEach((item, index) => {
        const alunoNome = String(item?.alunoPrevisto || "").trim();
        const itemKey = buildAgendaItemKey(item);
        const done = isAgendaItemDone(item, index, 0, 0, revertedSet);
        if (!done && linkedSet.size && alunoNome && !linkedSet.has(alunoNome)) {
          return;
        }
        const icon = done ? "☑" : "•";
        const doneBadge = done ? '<span class="agenda-done-badge">✓ Efetivado</span>' : "";
        const itemDate = resolveAgendaItemDate(item);
        const canMarkAbsence = !done && itemDate && isSameLocalDay(itemDate, new Date());
        const absenceDisabledAttr = canMarkAbsence ? "" : " disabled";
        const absenceTitle = canMarkAbsence
          ? "Marcar aluno como ausente"
          : "Disponível apenas no dia da saudação";
        const actions = done
          ? (
            '<div class="agenda-modal-item-actions">' +
              '<button class="secondary agenda-revert-btn" data-revert-effective="' + index + '" data-revert-key="' + escapeHtml(itemKey) + '">Tornar disponível</button>' +
            "</div>"
          )
          : (
            '<div class="agenda-modal-item-actions">' +
              '<button class="secondary agenda-absence-btn" title="' + escapeHtml(absenceTitle) + '"' + absenceDisabledAttr + ' data-mark-absence="' + index + '" data-mark-absence-pending="' + pendingIndex + '">Ausente</button>' +
              '<button class="secondary agenda-swap-btn" data-open-swap="' + pendingIndex + '">Trocar</button>' +
            "</div>"
          );
        if (!done) {
          agendaPendingRowsCache.push({
            pendingIndex,
            aluno: alunoNome
          });
          pendingIndex += 1;
        }
        const row = "<li class='" + (done ? "done" : "") + "'>" +
          '<div class="agenda-modal-item">' +
            '<div class="agenda-modal-item-text"><span class="agenda-check">' + icon + "</span>" + formatAgendaItem(item) + doneBadge + "</div>" +
            actions +
          "</div>" +
        "</li>";
        // Mantém a ordem original da agenda:
        // cada linha mostra apenas seu status (efetivado/pendente),
        // sem mover "efetivados" para um bloco separado.
        orderedRows.push(row);
      });
      const content = orderedRows.join("");
      agendaViewEls.list.innerHTML = content
        ? "<ul>" + content + "</ul>"
        : '<div class="muted-small">Sem agenda carregada.</div>';
    }

    function openAgendaModal() {
      renderAgendaModal();
      agendaViewEls.wrap.classList.add("open");
      agendaViewEls.wrap.setAttribute("aria-hidden", "false");
    }

    function closeAgendaModal() {
      agendaViewEls.wrap.classList.remove("open");
      agendaViewEls.wrap.setAttribute("aria-hidden", "true");
    }

    function debugLesson(context, details = {}) {
      if (!DEBUG_LESSON_FLOW) return;
      const payload = { context, ...details };
      console.log("[DEBUG_AULA]", payload);
    }

    function showInfoModal(options = {}) {
      infoEls.title.textContent = options.title || "Alteração concluída";
      infoEls.text.textContent = options.message || "Alteração feita com sucesso.";
      infoEls.wrap.classList.add("open");
      infoEls.wrap.setAttribute("aria-hidden", "false");
    }

    function closeInfoModal() {
      infoEls.wrap.classList.remove("open");
      infoEls.wrap.setAttribute("aria-hidden", "true");
    }

    function openConfirmModal(options = {}) {
      confirmEls.title.textContent = options.title || "Confirmar ação";
      confirmEls.text.textContent = options.message || "Deseja continuar?";
      confirmEls.ok.textContent = options.confirmLabel || "Confirmar";
      confirmEls.wrap.classList.add("open");
      confirmEls.wrap.setAttribute("aria-hidden", "false");
      return new Promise((resolve) => {
        confirmResolver = resolve;
      });
    }

    function closeConfirmModal(confirmed) {
      confirmEls.wrap.classList.remove("open");
      confirmEls.wrap.setAttribute("aria-hidden", "true");
      const resolver = confirmResolver;
      confirmResolver = null;
      if (resolver) resolver(Boolean(confirmed));
    }

    function openNewCycleModal() {
      if (!newCycleEls.wrap) return;
      if (newCycleEls.name) {
        newCycleEls.name.value = "";
      }
      newCycleEls.wrap.classList.add("open");
      newCycleEls.wrap.setAttribute("aria-hidden", "false");
      setTimeout(() => newCycleEls.name?.focus(), 40);
    }

    function closeNewCycleModal() {
      if (!newCycleEls.wrap) return;
      newCycleEls.wrap.classList.remove("open");
      newCycleEls.wrap.setAttribute("aria-hidden", "true");
    }

    function getLinkedStudentsFromAgendaItems(pendingOnly = false) {
      const linkedOrder = Array.isArray(latestStatusData?.state?.ordemVinculadaCiclo)
        ? latestStatusData.state.ordemVinculadaCiclo.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      if (!pendingOnly) {
        return [...linkedOrder];
      }

      const unique = new Set(linkedOrder);
      const doneSet = new Set();
      const revertedSet = new Set(
        Array.isArray(latestStatusData?.state?.revertidosEfetivados)
          ? latestStatusData.state.revertidosEfetivados.map((item) => String(item || ""))
          : []
      );

      for (let index = 0; index < (Array.isArray(agendaItemsCache) ? agendaItemsCache.length : 0); index += 1) {
        const item = agendaItemsCache[index];
        const done = isAgendaItemDone(item, index, 0, 0, revertedSet);
        const aluno = String(item?.alunoPrevisto || "").trim();
        if (!done || !aluno || !unique.has(aluno)) continue;
        doneSet.add(aluno);
      }
      return linkedOrder.filter((name) => !doneSet.has(name));
    }

    function getPendingStudentsWithNextDate() {
      const linkedSet = new Set(
        Array.isArray(latestStatusData?.state?.ordemVinculadaCiclo)
          ? latestStatusData.state.ordemVinculadaCiclo.map((item) => String(item || "").trim()).filter(Boolean)
          : []
      );
      const revertedSet = new Set(
        Array.isArray(latestStatusData?.state?.revertidosEfetivados)
          ? latestStatusData.state.revertidosEfetivados.map((item) => String(item || ""))
          : []
      );

      const linkedOrder = Array.isArray(latestStatusData?.state?.ordemVinculadaCiclo)
        ? latestStatusData.state.ordemVinculadaCiclo.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      const doneStudents = new Set();
      const byAluno = new Map();
      for (let index = 0; index < (Array.isArray(agendaItemsCache) ? agendaItemsCache.length : 0); index += 1) {
        const item = agendaItemsCache[index];
        const done = isAgendaItemDone(item, index, 0, 0, revertedSet);
        const aluno = String(item?.alunoPrevisto || "").trim();
        if (done) {
          if (aluno) doneStudents.add(aluno);
          continue;
        }
        if (linkedSet.size && !linkedSet.has(aluno)) continue;
        if (doneStudents.has(aluno)) continue;
        if (!aluno || byAluno.has(aluno)) continue;
        const itemDate = resolveAgendaItemDate(item);
        const nextDate = itemDate
          ? itemDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
          : "";
        byAluno.set(aluno, nextDate);
      }

      if (linkedOrder.length) {
        return linkedOrder
          .filter((name) => byAluno.has(name))
          .map((name) => ({ name, nextDate: byAluno.get(name) || "" }));
      }
      return Array.from(byAluno.entries()).map(([name, nextDate]) => ({ name, nextDate }));
    }

    function openSwapModal(pendingIndex) {
      const idx = Number(pendingIndex);
      if (!Number.isInteger(idx) || idx < 0) {
        setLog("Índice inválido para troca.", true);
        return;
      }
      const current = agendaPendingRowsCache.find((item) => item.pendingIndex === idx);
      if (!current || !current.aluno) {
        setLog("Aluno pendente não encontrado para troca.", true);
        return;
      }

      swapTargetPendingIndex = idx;
      swapFromAluno = current.aluno;
      swapEls.from.value = current.aluno;
      const options = agendaPendingRowsCache
        .filter((item) => item.pendingIndex !== idx && item.aluno)
        .map((item) =>
          '<option value="' + escapeHtml(item.aluno) + '">' +
            escapeHtml(item.aluno) +
          "</option>"
        );
      swapEls.to.innerHTML = '<option value="">Selecione</option>' + options.join("");
      swapEls.wrap.classList.add("open");
      swapEls.wrap.setAttribute("aria-hidden", "false");
    }

    function closeSwapModal() {
      swapTargetPendingIndex = -1;
      swapFromAluno = "";
      swapEls.from.value = "";
      swapEls.to.innerHTML = '<option value="">Selecione</option>';
      swapEls.wrap.classList.remove("open");
      swapEls.wrap.setAttribute("aria-hidden", "true");
    }

    function openEffectiveFixModal(index, itemKey, alunoPrevisto) {
      const idx = Number(index);
      if (!Number.isInteger(idx) || idx < 0 || idx >= agendaItemsCache.length) {
        setLog("Item inválido para correção de efetivação.", true);
        return;
      }
      const pendingStudents = getPendingStudentsWithNextDate();
      if (!pendingStudents.length) {
        setLog("Não há alunos pendentes para selecionar nesta correção.", true);
        return;
      }
      const options = ['<option value="">Selecione</option>']
        .concat(pendingStudents.map(({ name, nextDate }) =>
          '<option value="' + escapeHtml(name) + '">' +
            escapeHtml(nextDate ? (name + " (próxima: " + nextDate + ")") : name) +
          "</option>"
        ));
      effectiveFixContext = {
        index: idx,
        itemKey: String(itemKey || ""),
        alunoPrevisto: String(alunoPrevisto || "")
      };
      effectiveFixEls.expected.value = String(alunoPrevisto || "");
      effectiveFixEls.performer.innerHTML = options.join("");
      effectiveFixEls.performer.value = "";
      effectiveFixEls.wrap.classList.add("open");
      effectiveFixEls.wrap.setAttribute("aria-hidden", "false");
      setTimeout(() => effectiveFixEls.performer?.focus(), 40);
    }

    function closeEffectiveFixModal() {
      effectiveFixContext = { index: -1, itemKey: "", alunoPrevisto: "" };
      if (effectiveFixEls.expected) effectiveFixEls.expected.value = "";
      if (effectiveFixEls.performer) {
        effectiveFixEls.performer.innerHTML = '<option value="">Selecione</option>';
      }
      effectiveFixEls.wrap.classList.remove("open");
      effectiveFixEls.wrap.setAttribute("aria-hidden", "true");
    }

    function escapeHtml(text) {
      return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function normalizeText(value) {
      return String(value || "").trim();
    }

    function isNullWord(value) {
      return normalizeText(value).toLowerCase() === "null";
    }

    function markInvalidField(field, message, shouldFocus = AUTO_FOCUS_INVALID_FIELD) {
      if (!field) return false;
      field.classList.add("field-invalid");
      if (shouldFocus) {
        field.focus();
      }
      if (message) setLog(message, true);
      return false;
    }

    function clearInvalidField(field) {
      if (!field) return;
      field.classList.remove("field-invalid");
    }

    function getDestinationFormState() {
      return {
        to: normalizeText(els.to.value),
        groupId: normalizeText(getGroupIdValue()),
        groupName: normalizeText(els.groupName.value)
      };
    }

    function getConfigFormState() {
      return {
        turma: normalizeText(els.turma.value),
        instituicao: normalizeText(els.instituicao.value),
        antecedenciaMin: String(Number(els.antecedenciaMin.value || 0)),
        diasUteisApenas: String(els.diasUteisApenas.value),
        lockTimeoutMin: String(Number(els.lockTimeoutMin.value || 15))
      };
    }

    function setLockFeedback(message, type) {
      if (!lockFeedbackEl) return;
      lockFeedbackEl.textContent = message || "";
      lockFeedbackEl.className = "wa-login-feedback" + (type ? " " + type : "");
    }

    function lockScreen(message) {
      if (!lockConfigured) return;
      isScreenLocked = true;
      if (autoLockTimer) {
        clearTimeout(autoLockTimer);
        autoLockTimer = null;
      }
      lockOverlayEl.classList.remove("hidden");
      lockTextEl.textContent = message || "Digite a senha para continuar.";
      lockInputEl.value = "";
      setLockFeedback("", "");
      setTimeout(() => lockInputEl.focus(), 40);
    }

    function unlockScreen() {
      isScreenLocked = false;
      lockOverlayEl.classList.add("hidden");
      lockInputEl.value = "";
      setLockFeedback("", "");
      lastUserActivityAt = Date.now();
      scheduleAutoLock();
    }

    function touchUserActivity() {
      if (isScreenLocked) return;
      lastUserActivityAt = Date.now();
      scheduleAutoLock();
    }

    function scheduleAutoLock() {
      if (autoLockTimer) {
        clearTimeout(autoLockTimer);
        autoLockTimer = null;
      }
      const currentPhase = String(latestStatusData?.whatsapp?.phase || "");
      const whatsappLoginRequired = shouldShowWhatsAppLogin(currentPhase);
      if (!lockConfigured || isScreenLocked || whatsappLoginRequired) return;
      autoLockTimer = setTimeout(() => {
        lockScreen("Tempo de bloqueio atingido. Digite a senha para continuar.");
      }, Math.max(1000, lockTimeoutMs));
    }

    function statesEqual(a, b) {
      return (
        String(a?.to ?? "") === String(b?.to ?? "") &&
        String(a?.groupId ?? "") === String(b?.groupId ?? "") &&
        String(a?.groupName ?? "") === String(b?.groupName ?? "") &&
        String(a?.turma ?? "") === String(b?.turma ?? "") &&
        String(a?.instituicao ?? "") === String(b?.instituicao ?? "") &&
        String(a?.antecedenciaMin ?? "") === String(b?.antecedenciaMin ?? "") &&
        String(a?.diasUteisApenas ?? "") === String(b?.diasUteisApenas ?? "") &&
        String(a?.lockTimeoutMin ?? "") === String(b?.lockTimeoutMin ?? "")
      );
    }

    function updateSaveButtonsState() {
      const destCurrent = getDestinationFormState();
      const cfgCurrent = getConfigFormState();
      const destDirty = !statesEqual(destCurrent, destinationSnapshot);
      const cfgDirty = !statesEqual(cfgCurrent, configSnapshot);
      const lockPasswordDirty = normalizeText(els.lockPassword?.value || "").length > 0;
      if (btnSaveDestination) btnSaveDestination.disabled = !destDirty;
      if (btnSaveConfig) btnSaveConfig.disabled = !(cfgDirty || lockPasswordDirty);
    }

    function updateStartButtonsState() {
      const currentIdxAluno = String(els.startAluno?.value || "");
      const currentIdxAula = String(els.startAula?.value || "");
      const currentDataInicio = String(els.startDate?.value || "").trim();
      const alunoDirty = currentIdxAluno !== String(startSnapshot.idxAluno || "");
      const aulaDirty = currentIdxAula !== String(startSnapshot.idxAula || "");
      const dataDirty = currentDataInicio !== String(startSnapshot.dataInicio || "");
      const pairDirty = aulaDirty || dataDirty;
      const hasStartedCycle = Number(latestStatusData?.cycle?.active?.sentCount || 0) > 0;
      const lockStartInputs = Boolean(latestStatusData?.cycle?.active) && hasStartedCycle;

      if (els.startAluno) els.startAluno.disabled = lockStartInputs;
      if (els.startAula) els.startAula.disabled = lockStartInputs;
      if (els.startDate) els.startDate.disabled = lockStartInputs;

      if (btnSaveStartAluno) btnSaveStartAluno.disabled = lockStartInputs || !alunoDirty;
      if (btnSaveStartAula) btnSaveStartAula.disabled = lockStartInputs || !pairDirty;
      if (btnSaveStartDate) btnSaveStartDate.disabled = lockStartInputs || !pairDirty;

      if (els.startAluno) els.startAluno.classList.toggle("field-dirty", alunoDirty);
      if (els.startAula) els.startAula.classList.toggle("field-dirty", aulaDirty);
      if (els.startDate) els.startDate.classList.toggle("field-dirty", dataDirty);
    }

    function validateStartAulaAndDatePair() {
      const idx = Number(els.startAula.value);
      const dataInicio = String(els.startDate.value || "").trim();
      if (!Number.isInteger(idx) || !dataInicio) {
        return true;
      }

      const selectedAula = currentScheduleItems[idx];
      if (!selectedAula) {
        return true;
      }

      const date = parseDateOnly(dataInicio);
      if (!date) {
        markInvalidField(els.startDate, "Data de início inválida.");
        return false;
      }

      const aulaDia = Number(selectedAula.dia);
      if (date.getDay() !== aulaDia) {
        const labels = {
          "0": "domingo",
          "1": "segunda-feira",
          "2": "terça-feira",
          "3": "quarta-feira",
          "4": "quinta-feira",
          "5": "sexta-feira",
          "6": "sábado"
        };
        const diaEsperado = labels[String(aulaDia)] || ("dia " + aulaDia);
        markInvalidField(
          els.startDate,
          "A data de início não corresponde ao dia da aula inicial. Para a aula selecionada, escolha uma " + diaEsperado + "."
        );
        markInvalidField(els.startAula, "");
        return false;
      }

      clearInvalidField(els.startDate);
      clearInvalidField(els.startAula);
      return true;
    }

    function alignDateToWeekday(baseDate, targetWeekday) {
      if (!(baseDate instanceof Date) || Number.isNaN(baseDate.getTime())) return null;
      const weekday = Number(targetWeekday);
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;
      const date = new Date(baseDate);
      const diff = (weekday - date.getDay() + 7) % 7;
      date.setDate(date.getDate() + diff);
      return date;
    }

    function findFirstLessonIndexByWeekday(weekday) {
      const day = Number(weekday);
      if (!Number.isInteger(day)) return -1;
      for (let i = 0; i < currentScheduleItems.length; i += 1) {
        if (Number(currentScheduleItems[i]?.dia) === day) {
          return i;
        }
      }
      return -1;
    }

    function refreshStudentActionButtons() {
      const editing = editingStudentIndex >= 0;
      btnSaveStudentEdit.classList.toggle("is-hidden", !editing);
      if (editing) {
        btnAddStudent.disabled = true;
      } else {
        updateAddStudentButtonState();
      }
    }

    function refreshLessonActionButtons() {
      const editing = editingLessonIndex >= 0;
      btnAddLesson.classList.toggle("is-hidden", editing);
      btnSaveLessonEdit.classList.toggle("is-hidden", !editing);
      btnCancelLessonEdit.classList.toggle("is-hidden", !editing);
      if (!editing) {
        clearLessonValidation();
        updateAddLessonButtonState();
      }
    }

    function isValidStudentName(name) {
      const normalized = normalizeText(name);
      return normalized.length >= 2 && !isNullWord(normalized);
    }

    function isValidLessonForm() {
      const dia = normalizeText(modalEls.dia.value);
      const hora = normalizeHourInput(modalEls.hora.value);
      const materia = normalizeText(modalEls.materia.value);
      const professor = normalizeText(modalEls.professor.value);
      return (
        !!dia &&
        !!hora &&
        materia.length >= 2 &&
        !isNullWord(materia) &&
        professor.length >= 2 &&
        !isNullWord(professor)
      );
    }

    function updateAddStudentButtonState() {
      if (editingStudentIndex >= 0) {
        btnAddStudent.disabled = true;
        return;
      }
      btnAddStudent.disabled = !isValidStudentName(modalEls.studentName?.value);
    }

    function updateAddLessonButtonState() {
      if (editingLessonIndex >= 0) {
        btnAddLesson.disabled = true;
        return;
      }
      btnAddLesson.disabled = !isValidLessonForm();
    }

    function clearStudentInput() {
      if (modalEls.studentName) modalEls.studentName.value = "";
      clearInvalidField(modalEls.studentName);
      updateAddStudentButtonState();
    }

    function readLessonForm() {
      return {
        dia: String(modalEls.dia?.value || "").trim(),
        hora: normalizeHourInput(modalEls.hora?.value || ""),
        titulo: normalizeText(modalEls.titulo?.value || ""),
        materia: normalizeText(modalEls.materia?.value || ""),
        professor: normalizeText(modalEls.professor?.value || "")
      };
    }

    function fillLessonForm(lesson) {
      if (!lesson) return;
      if (modalEls.dia) modalEls.dia.value = String(lesson.dia || "1");
      if (modalEls.hora) modalEls.hora.value = String(lesson.hora || "");
      if (modalEls.titulo) modalEls.titulo.value = String(lesson.titulo || "");
      if (modalEls.materia) modalEls.materia.value = String(lesson.materia || "");
      if (modalEls.professor) modalEls.professor.value = String(lesson.professor || "");
      clearLessonValidation();
      updateAddLessonButtonState();
    }

    function validateLessonFormAndMark() {
      clearLessonValidation();
      const lesson = readLessonForm();

      if (!lesson.dia) return markInvalidField(modalEls.dia, "Selecione o dia da aula.");
      if (!lesson.hora) return markInvalidField(modalEls.hora, "Hora inválida. Use formato HH:MM.");
      if (lesson.titulo && (lesson.titulo.length < 2 || isNullWord(lesson.titulo))) {
        return markInvalidField(modalEls.titulo, "Título inválido.");
      }
      if (lesson.materia.length < 2 || isNullWord(lesson.materia)) {
        return markInvalidField(modalEls.materia, "Matéria inválida.");
      }
      if (lesson.professor.length < 2 || isNullWord(lesson.professor)) {
        return markInvalidField(modalEls.professor, "Professor inválido.");
      }

      return lesson;
    }

    function clearLessonValidation() {
      clearInvalidField(modalEls.dia);
      clearInvalidField(modalEls.hora);
      clearInvalidField(modalEls.titulo);
      clearInvalidField(modalEls.materia);
      clearInvalidField(modalEls.professor);
    }

    function clearLessonInputs() {
      if (modalEls.dia) modalEls.dia.value = "1";
      if (modalEls.hora) modalEls.hora.value = "";
      if (modalEls.titulo) modalEls.titulo.value = "";
      if (modalEls.materia) modalEls.materia.value = "";
      if (modalEls.professor) modalEls.professor.value = "";
      clearLessonValidation();
      updateAddLessonButtonState();
    }

    function hydrateModalData(data) {
      const alunos = Array.isArray(data?.alunos) ? data.alunos : [];
      const agendaSemanal = data?.agendaSemanal && typeof data.agendaSemanal === "object" ? data.agendaSemanal : {};
      const lessons = [];
      Object.entries(agendaSemanal).forEach(([dia, aulas]) => {
        const arr = Array.isArray(aulas) ? aulas : [aulas];
        arr.forEach((aula) => {
          if (!aula) return;
          lessons.push({
            dia: String(dia),
            hora: String(aula.hora || ""),
            titulo: String(aula.titulo || ""),
            materia: String(aula.materia || ""),
            professor: String(aula.professor || "")
          });
        });
      });
      modalData = { alunos: [...alunos], lessons };
    }

    function buildAgendaSemanalFromLessons() {
      const agenda = {};
      (Array.isArray(modalData?.lessons) ? modalData.lessons : []).forEach((lesson) => {
        const dia = String(lesson?.dia || "");
        if (!dia) return;
        if (!agenda[dia]) agenda[dia] = [];
        const item = {
          hora: String(lesson?.hora || ""),
          materia: String(lesson?.materia || ""),
          professor: String(lesson?.professor || "")
        };
        const titulo = String(lesson?.titulo || "").trim();
        if (titulo) item.titulo = titulo;
        agenda[dia].push(item);
      });
      return agenda;
    }

    function renderModalStudents() {
      if (!modalEls.students) return;
      const rows = (Array.isArray(modalData?.alunos) ? modalData.alunos : []).map((name, index) =>
        '<div class="student-item">' +
          "<span>" + escapeHtml(String(name || "")) + "</span>" +
          '<div class="student-actions">' +
            '<button class="secondary icon-btn" title="Editar aluno" aria-label="Editar aluno" data-edit-student="' + index + '">✎</button>' +
            '<button class="secondary icon-btn" title="Excluir aluno" aria-label="Excluir aluno" data-remove-student="' + index + '">🗑</button>' +
          "</div>" +
        "</div>"
      );
      modalEls.students.innerHTML = rows.join("") || '<div class="muted-small">Sem alunos cadastrados.</div>';
    }

    function renderModalLessons() {
      if (!modalEls.lessons) return;
      // Base principal: data de início do ciclo/configuração.
      // Fallback: hoje (00:00) apenas se não houver data de início válida.
      const startDateRaw = String(latestStatusData?.state?.dataInicio || "").trim();
      const parsedStartDate = parseDateOnly(startDateRaw);
      const referenceDate = parsedStartDate || new Date();
      if (!parsedStartDate) {
        referenceDate.setHours(0, 0, 0, 0);
      }
      const weekdayOccurrenceMap = new Map();

      const sourceRows = (Array.isArray(modalData?.lessons) ? modalData.lessons : []).map((lesson, index) => {
        const nextDate = computeNextScheduledDate(lesson.dia, lesson.hora, referenceDate);
        const dayKey = String(lesson?.dia || "");
        const occurrenceIndex = Number(weekdayOccurrenceMap.get(dayKey) || 0);
        if (nextDate instanceof Date && occurrenceIndex > 0) {
          nextDate.setDate(nextDate.getDate() + (occurrenceIndex * 7));
        }
        weekdayOccurrenceMap.set(dayKey, occurrenceIndex + 1);
        return {
          lesson,
          index,
          nextDate,
          nextDateLabel: nextDate ? formatDatePtBr(nextDate) : "-"
        };
      });

      const rowsToRender = [...sourceRows].sort((a, b) => {
        const left = a.nextDate instanceof Date ? a.nextDate.getTime() : Number.POSITIVE_INFINITY;
        const right = b.nextDate instanceof Date ? b.nextDate.getTime() : Number.POSITIVE_INFINITY;
        if (left !== right) return left - right;
        return a.index - b.index;
      });

      const rows = rowsToRender.map(({ lesson, index, nextDateLabel }) =>
        "<tr>" +
          "<td>" + dayLabel(lesson.dia) + "</td>" +
          "<td>" + String(lesson.hora || "") + "</td>" +
          "<td>" + nextDateLabel + "</td>" +
          "<td>" + escapeHtml(String(lesson.titulo || "")) + "</td>" +
          "<td>" + String(lesson.materia || "") + "</td>" +
          "<td>" + String(lesson.professor || "") + "</td>" +
          '<td><button class="secondary icon-btn" title="Editar aula" aria-label="Editar aula" data-edit-lesson="' + index + '">✎</button></td>' +
          '<td><button class="secondary icon-btn" title="Excluir aula" aria-label="Excluir aula" data-remove-lesson="' + index + '">🗑</button></td>' +
        "</tr>"
      );
      modalEls.lessons.innerHTML =
        '<table class="table"><thead><tr><th>Dia</th><th>Hora</th><th>Próxima data</th><th>Título</th><th>Matéria</th><th>Professor</th><th></th><th></th></tr></thead><tbody>' +
        (rows.join("") || '<tr><td colspan="8" class="muted-small">Sem aulas cadastradas.</td></tr>') +
        "</tbody></table>";
    }

    function getGroupIdValue() {
      return els.groupId ? String(els.groupId.value || "") : "";
    }

    function setGroupIdValue(value) {
      if (els.groupId) {
        els.groupId.value = String(value || "");
      }
    }

    function clearGroupDestinationFields() {
      if (els.groupSelect) {
        els.groupSelect.value = "";
      }
      setGroupIdValue("");
      els.groupName.value = "";
      updateSaveButtonsState();
    }

    function normalizeHourInput(rawValue) {
      const original = normalizeText(rawValue);
      if (!original) return "";
      const normalizedSource = original
        .normalize("NFKC")
        .replace(/[hH\.]/g, ":")
        .replace(/[,;：﹕ː]/g, ":")
        .replace(/[-_]/g, ":");

      let hours;
      let minutes;

      // Extrai blocos numéricos sem regex para evitar inconsistências no script embutido.
      const numericParts = [];
      let current = "";
      for (const ch of normalizedSource) {
        if (ch >= "0" && ch <= "9") {
          current += ch;
        } else if (current) {
          numericParts.push(current);
          current = "";
        }
      }
      if (current) {
        numericParts.push(current);
      }

      if (numericParts.length >= 2) {
        // Ex.: 23:55, 23:55:00, 23h55
        hours = Number(numericParts[0]);
        minutes = Number(numericParts[1]);
      } else {
        // Ex.: 1600, 900
        let digitsOnly = "";
        for (const ch of normalizedSource) {
          if (ch >= "0" && ch <= "9") {
            digitsOnly += ch;
          }
        }

        if (!(digitsOnly.length === 3 || digitsOnly.length === 4)) return "";
        const hh = digitsOnly.length === 3 ? digitsOnly.slice(0, 1) : digitsOnly.slice(0, 2);
        const mm = digitsOnly.slice(-2);
        hours = Number(hh);
        minutes = Number(mm);
      }

      if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return "";
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return "";

      return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");
    }

    function normalizeHourFieldValue() {
      const normalized = normalizeHourInput(modalEls.hora.value);
      if (normalized) {
        modalEls.hora.value = normalized;
        clearInvalidField(modalEls.hora);
      }
      return normalized;
    }

    function statusEmPortugues(phase) {
      const labels = {
        ready: "pronto",
        authenticated: "autenticado",
        initializing: "inicializando",
        qr: "aguardando QR",
        disconnected: "desconectado",
        auth_failure: "falha de autenticação",
        idle: "inativo"
      };

      if (labels[phase]) return labels[phase];
      if (String(phase || "").startsWith("state:")) {
        return "estado: " + phase.replace("state:", "");
      }
      return phase || "desconhecido";
    }

    function statusClasse(phase) {
      if (phase === "ready" || phase === "authenticated") return "status-ok";
      if (phase === "disconnected" || phase === "auth_failure") return "status-error";
      return "status-warn";
    }

    function setWaLoginFeedback(message, type) {
      if (!waLoginFeedbackEl) return;
      const iconMap = {
        ok: "✓",
        error: "⚠",
        info: "ℹ"
      };
      const icon = iconMap[type] || (message ? "ℹ" : "");
      waLoginFeedbackEl.textContent = message ? (icon + " " + String(message || "")) : "";
      waLoginFeedbackEl.className = "wa-login-feedback" + (type ? " " + type : "");
    }

    function showQrConnectOverlay(message) {
      if (!qrConnectOverlayEl) return;
      if (qrConnectTimer) {
        clearTimeout(qrConnectTimer);
        qrConnectTimer = null;
      }
      if (qrConnectTextEl) {
        qrConnectTextEl.textContent = message || "QR validado. Carregando e acessando a aplicação...";
      }
      qrConnectOverlayEl.classList.remove("hidden");
      qrConnectTimer = setTimeout(() => {
        qrConnectOverlayEl.classList.add("hidden");
        qrConnectTimer = null;
      }, 900);
    }

    function hideQrConnectOverlay() {
      if (!qrConnectOverlayEl) return;
      if (qrConnectTimer) {
        clearTimeout(qrConnectTimer);
        qrConnectTimer = null;
      }
      qrConnectOverlayEl.classList.add("hidden");
    }

    function shouldShowWhatsAppLogin(phase) {
      const p = String(phase || "");
      const hasSender = Boolean(String(latestStatusData?.whatsapp?.sender || "").trim());
      const hasQr = Boolean(latestStatusData?.whatsapp?.qrAvailable);

      // Exibir tela de login somente quando houver sinal explícito de reconexão.
      if (hasQr || p === "qr" || p === "disconnected" || p === "auth_failure") {
        return true;
      }

      // Sessão válida não deve cair na tela de QR.
      if (p === "ready" || p === "authenticated" || hasSender) {
        return false;
      }

      // Estados transitórios (initializing/idle/unknown) não devem forçar QR.
      return false;
    }

    function updateWhatsAppLoginOverlay(data) {
      if (!waLoginOverlayEl) return;
      const phase = String(data?.whatsapp?.phase || "");
      const show = shouldShowWhatsAppLogin(phase);
      const wasShowingLogin = shouldShowWhatsAppLogin(lastWaPhaseForOverlay);

      if (!show) {
        waLoginOverlayEl.classList.add("hidden");
        setWaLoginFeedback("", "");
        if (wasShowingLogin) {
          showQrConnectOverlay("QR validado. Carregando e acessando a aplicação...");
        }
        lastWaPhaseForOverlay = phase;
        return;
      }

      hideQrConnectOverlay();

      let text = "Aguardando conexão do WhatsApp Web.";
      if (phase === "qr") {
        text = "Escaneie o QR Code com o WhatsApp para reconectar a sessão.";
      } else if (phase === "disconnected") {
        text = "WhatsApp desconectado. Clique em “Gerar QR” para iniciar novo login.";
      } else if (phase === "auth_failure") {
        text = "Falha de autenticação. Gere um novo QR Code para reconectar.";
      } else if (phase === "initializing") {
        text = "Inicializando sessão do WhatsApp Web...";
      }

      if (waLoginTextEl) {
        waLoginTextEl.textContent = text;
      }

      const qrDataUrl = String(data?.whatsapp?.qrImageDataUrl || "");
      if (qrDataUrl) {
        waLoginQrEl.src = qrDataUrl;
        waLoginQrEl.classList.remove("is-hidden");
        waLoginEmptyEl.classList.add("is-hidden");
        setWaLoginFeedback("QR pronto. Escaneie com seu WhatsApp.", "ok");
      } else {
        waLoginQrEl.removeAttribute("src");
        waLoginQrEl.classList.add("is-hidden");
        waLoginEmptyEl.classList.remove("is-hidden");
        if (phase !== "ready" && phase !== "authenticated") {
          setWaLoginFeedback("Aguardando geração do QR...", "");
        }
      }

      waLoginOverlayEl.classList.remove("hidden");
      lastWaPhaseForOverlay = phase;
    }

    function renderState(data) {
      const phase = data.whatsapp.phase || "desconhecido";
      const whatsappReady = phase === "ready" || phase === "authenticated" || Boolean(data?.whatsapp?.sender);
      els.statusBadge.className = "status " + statusClasse(phase);
      els.statusBadge.innerHTML = '<span class="dot"></span><span>' + statusEmPortugues(phase) + '</span>';
      updateWhatsAppLoginOverlay(data);
      if (shouldShowWhatsAppLogin(phase) && isScreenLocked) {
        unlockScreen();
        setLog("Sessão do WhatsApp desconectada. Painel de QR aberto para reconexão.");
      }
      const statusRows = [
        { label: "Sessão", value: data.whatsapp.sender || "ainda não autenticada" },
        { label: "Agendador", value: data.schedulerStarted ? "ativo" : "parado" },
        { label: "QR pendente", value: data.whatsapp.qrAvailable ? "sim" : "não" },
        data.whatsapp.lastError ? { label: "Último erro", value: data.whatsapp.lastError } : null
      ].filter(Boolean);
      els.statusLines.setAttribute("aria-busy", "false");
      els.statusLines.innerHTML = '<div class="status-lines-grid">' + statusRows.map((row) =>
        '<div class="status-line"><span class="status-label">' + row.label + '</span><span class="status-value">' + row.value + "</span></div>"
      ).join("") + "</div>";

      updateManualSendButtonsState();

      els.to.value = data.settings.to || "";
      setGroupIdValue(data.settings.groupId || "");
      els.groupName.value = data.settings.groupName || "";
      els.turma.value = data.config.turma || "";
      els.instituicao.value = data.config.instituicao || "";
      els.antecedenciaMin.value = data.config.antecedenciaMin ?? 0;
      els.diasUteisApenas.value = String(Boolean(data.config.diasUteisApenas));
      els.lockTimeoutMin.value = String(Number(data.config.lockTimeoutMin || 15));
      lockConfigured = Boolean(data.config.lockConfigured);
      lockTimeoutMs = Math.max(1, Number(data.config.lockTimeoutMin || 15)) * 60 * 1000;
      btnLockNow.disabled = !lockConfigured;
      if (!lockConfigured && isScreenLocked) {
        unlockScreen();
      }
      scheduleAutoLock();
      destinationSnapshot = {
        to: normalizeText(data.settings.to || ""),
        groupId: normalizeText(data.settings.groupId || ""),
        groupName: normalizeText(data.settings.groupName || "")
      };
      configSnapshot = {
        turma: normalizeText(data.config.turma || ""),
        instituicao: normalizeText(data.config.instituicao || ""),
        antecedenciaMin: String(Number(data.config.antecedenciaMin ?? 0)),
        diasUteisApenas: String(Boolean(data.config.diasUteisApenas)),
        lockTimeoutMin: String(Number(data.config.lockTimeoutMin || 15))
      };

      const alunos = Array.isArray(data.config?.alunos) ? data.config.alunos : [];
      if (alunos.length > 0) {
        const startOptions = alunos.map((name, index) =>
          '<option value="' + index + '">' + (index + 1) + " - " + escapeHtml(name) + "</option>"
        );
        els.startAluno.innerHTML = startOptions.join("");
        const idxAtual = Number(data.state?.idxAluno || 0);
        els.startAluno.value = String(((idxAtual % alunos.length) + alunos.length) % alunos.length);
      } else {
        els.startAluno.innerHTML = '<option value="">Sem alunos cadastrados</option>';
      }

      const scheduleItems = Array.isArray(data.scheduleSummary) ? data.scheduleSummary : [];
      currentScheduleItems = scheduleItems;
      if (scheduleItems.length > 0) {
        const diaLongo = {
          "0": "domingo",
          "1": "segunda-feira",
          "2": "terça-feira",
          "3": "quarta-feira",
          "4": "quinta-feira",
          "5": "sexta-feira",
          "6": "sábado"
        };
        const aulaOptions = scheduleItems.map((item, index) => {
          const day = diaLongo[String(item.dia)] || ("dia " + item.dia);
          const label = day + " " + item.horario + " | " + item.materia;
          return '<option value="' + index + '">' + (index + 1) + " - " + escapeHtml(label) + "</option>";
        });
        els.startAula.innerHTML = aulaOptions.join("");
        const idxAulaAtual = Number(data.state?.idxAula || 0);
        els.startAula.value = String(((idxAulaAtual % scheduleItems.length) + scheduleItems.length) % scheduleItems.length);
      } else {
        els.startAula.innerHTML = '<option value="">Sem aulas cadastradas</option>';
      }

      els.startDate.value = String(data.state?.dataInicio || "");
      startSnapshot = {
        idxAluno: String(els.startAluno?.value || ""),
        idxAula: String(els.startAula?.value || ""),
        dataInicio: String(els.startDate?.value || "").trim()
      };
      updateStartButtonsState();

      const activeCycle = data?.cycle?.active || null;
      const activeSentCount = Number(activeCycle?.sentCount || 0);
      const filaReposicao = Array.isArray(data?.state?.reposicaoAlunos) ? data.state.reposicaoAlunos : [];
      if (activeCycle) {
        const sent = activeSentCount;
        const total = Number(activeCycle.totalAlunos || 0);
        const pct = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;
        const cycleName = String(activeCycle.name || "").trim();
        els.heroCycle.textContent = cycleName ? ("Ciclo atual: " + cycleName) : "Ciclo atual: sem nome";
        els.heroCycle.style.display = "";
        const cycleNameText = cycleName ? 'Nome: "' + cycleName + '". ' : "";
        els.cycleInfo.textContent = "Ciclo ativo. " + cycleNameText + sent + "/" + total + " aluno(s) enviado(s) (" + pct + "%). " +
          "Reposição pendente: " + filaReposicao.length + ".";
      } else {
        els.heroCycle.textContent = "";
        els.heroCycle.style.display = "none";
        els.cycleInfo.textContent = "Sem ciclo ativo. Você pode iniciar um novo ciclo. " +
          "Reposição pendente: " + filaReposicao.length + ".";
      }
      btnNewCycle.disabled = Boolean(activeCycle);
      btnCancelCycle.disabled = !Boolean(activeCycle);
      if (activeCycle && activeSentCount > 0) {
        setLog("Início bloqueado: o ciclo já começou. Para alterar início, cancele e crie um novo ciclo.", true);
      }

      cycleHistoryCache = Array.isArray(data?.cycle?.history) ? data.cycle.history : [];
      renderCycleHistorySummary();

      const agendaItems = Array.isArray(data.schedulePreview) && data.schedulePreview.length
        ? data.schedulePreview
        : [];
      renderAgendaPreview(agendaItems);
      renderNextGreetings(agendaItems);

      if (data.lastRun) {
        const typeLabels = {
          scheduled: "Agendado",
          forced: "Forçado",
          test: "Teste",
          custom: "Manual"
        };
        const reasonLabels = {
          fora_de_dia_util: "Fora de dia útil",
          sem_aula_no_dia: "Sem aula no dia"
        };

        const when = data.lastRun.sentAt
          ? new Date(data.lastRun.sentAt).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "medium"
            })
          : "-";

        const fullId = String(data.lastRun.messageId || "");
        const shortId = fullId.length > 44
          ? fullId.slice(0, 24) + "..." + fullId.slice(-16)
          : fullId;

        const rows = [
          '<div class="last-run-item"><b>Tipo:</b> ' + (typeLabels[data.lastRun.type] || data.lastRun.type || "-") + "</div>",
          '<div class="last-run-item"><b>Quando:</b> ' + when + "</div>",
          data.lastRun.aluno ? '<div class="last-run-item"><b>Aluno:</b> ' + data.lastRun.aluno + "</div>" : "",
          data.lastRun.materia ? '<div class="last-run-item"><b>Matéria:</b> ' + data.lastRun.materia + "</div>" : "",
          data.lastRun.reason ? '<div class="last-run-item"><b>Motivo:</b> ' + (reasonLabels[data.lastRun.reason] || data.lastRun.reason) + "</div>" : ""
        ].filter(Boolean);

        els.lastRun.innerHTML = '<div class="last-run-list">' + rows.join("") + "</div>";
      } else {
        els.lastRun.textContent = "Nenhum envio ainda.";
      }

      const firstGroupOptionText = String(els.groupSelect?.options?.[0]?.textContent || "");
      const groupStateNeedsRetry =
        firstGroupOptionText.toLowerCase().includes("falha ao carregar grupos") ||
        firstGroupOptionText.toLowerCase().includes("aguardando whatsapp");
      if (whatsappReady && groupStateNeedsRetry) {
        loadGroups().catch(() => {});
      }

      updateSaveButtonsState();
    }

    async function fetchJson(url, options) {
      let res;
      try {
        res = await fetch(url, options);
      } catch (error) {
        throw new Error("Falha de conexão com o dashboard. Verifique se o servidor está ligado.");
      }

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("Resposta inválida do servidor.");
      }

      if (!res.ok) {
        throw new Error(data.error || "Falha na requisição");
      }
      return data;
    }

    async function refresh() {
      if (isRefreshing) return latestStatusData;
      isRefreshing = true;
      try {
        const data = await fetchJson("/api/status");
        latestStatusData = data;
        initialStatusLoaded = true;
        renderState(data);
        updateAppReadinessGate(data);
        return data;
      } catch (error) {
        setLog(error.message, true);
        throw error;
      } finally {
        isRefreshing = false;
      }
    }

    function startAutoRefreshLoop() {
      const run = async () => {
        try {
          await refresh();
        } catch {
          // erro já tratado em refresh()
        } finally {
          const phase = String(latestStatusData?.whatsapp?.phase || "");
          const needsQr = shouldShowWhatsAppLogin(phase);
          const delayMs = needsQr ? 1000 : 3000;
          refreshLoopTimer = setTimeout(run, delayMs);
        }
      };

      if (refreshLoopTimer) {
        clearTimeout(refreshLoopTimer);
        refreshLoopTimer = null;
      }
      run();
    }

    async function requestWhatsAppReconnect() {
      if (isRequestingWhatsAppReconnect) return;
      isRequestingWhatsAppReconnect = true;
      btnWaReconnect.disabled = true;
      showQrConnectOverlay("Solicitando QR e preparando acesso...");
      setWaLoginFeedback("Solicitando novo QR...", "");
      try {
        setLog("Solicitando reconexão do WhatsApp...");
        const data = await fetchJson("/api/whatsapp/reconnect", { method: "POST" });
        setLog(data.message || "Reconexão iniciada.");
        setWaLoginFeedback("Reconexão iniciada. Aguarde o QR aparecer.", "ok");
        await refresh();
      } catch (error) {
        setLog(error.message || "Falha ao reconectar WhatsApp.", true);
        setWaLoginFeedback(error.message || "Falha ao gerar QR.", "error");
      } finally {
        isRequestingWhatsAppReconnect = false;
        btnWaReconnect.disabled = false;
      }
    }

    function dayLabel(dia) {
      const labels = { "0": "Dom", "1": "Seg", "2": "Ter", "3": "Qua", "4": "Qui", "5": "Sex", "6": "Sáb" };
      return labels[String(dia)] || String(dia);
    }

    function rowsFromAgendaSemanal(agendaSemanal) {
      const rows = [];
      Object.entries(agendaSemanal || {}).forEach(([dia, aulas]) => {
        const list = Array.isArray(aulas) ? aulas : [aulas];
        list.forEach((aula) => {
          rows.push({
            dia: String(dia),
            hora: aula.hora || "",
            materia: aula.materia || "",
            professor: aula.professor || ""
          });
        });
      });
      return rows;
    }

    function agendaSemanalFromRows(rows) {
      const agenda = {};
      rows.forEach((row) => {
        if (!agenda[row.dia]) agenda[row.dia] = [];
        agenda[row.dia].push({
          materia: row.materia,
          professor: row.professor,
          hora: row.hora
        });
      });
      return agenda;
    }

    async function persistAgendaFromModal(successMessage) {
      const payload = {
        alunos: modalData.alunos,
        agendaSemanal: buildAgendaSemanalFromLessons()
      };

      const data = await fetchJson("/api/agenda-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      hydrateModalData(data);
      renderModalStudents();
      renderModalLessons();

      if (successMessage) {
        setLog(successMessage);
      } else {
        setLog(data.message || "Dados salvos.");
      }
      return data;
    }

    function renderEasyAgendaTable() {
      if (!easyAgendaRows.length) {
        els.easyAgendaTable.textContent = "Sem aulas.";
        return;
      }

      const lines = easyAgendaRows.map((row, index) =>
        "<tr>" +
          "<td>" + dayLabel(row.dia) + " (" + row.dia + ")</td>" +
          "<td>" + row.hora + "</td>" +
          "<td>" + row.materia + "</td>" +
          "<td>" + row.professor + "</td>" +
          '<td><button class="secondary" data-remove-row="' + index + '">Remover</button></td>' +
        "</tr>"
      ).join("");

      els.easyAgendaTable.innerHTML = "<table class='table'><thead><tr><th>Dia</th><th>Hora</th><th>Matéria</th><th>Professor</th><th></th></tr></thead><tbody>" + lines + "</tbody></table>";
    }

    async function openJsonEditor() {
      setLog("Carregando JSON...");
      try {
        const data = await fetchJson("/api/agenda-json");
        els.agendaJson.value = JSON.stringify(data, null, 2);
        els.easyAlunos.value = (data.alunos || []).join("\\n");
        easyAgendaRows = rowsFromAgendaSemanal(data.agendaSemanal);
        renderEasyAgendaTable();
        els.easyEditorWrap.style.display = "block";
        setLog("Editor carregado. Você pode editar por formulário e salvar.");
      } catch (error) {
        setLog(error.message, true);
      }
    }

    async function loadGroups() {
      if (isLoadingGroups) return;
      isLoadingGroups = true;
      const withTimeout = async (promise, timeoutMs) => {
        return await Promise.race([
          promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error("Tempo limite para carregar grupos.")), timeoutMs))
        ]);
      };
      try {
        const phase = String(latestStatusData?.whatsapp?.phase || "");
        const ready = phase === "ready" || phase === "authenticated" || Boolean(String(latestStatusData?.whatsapp?.sender || ""));
        if (!ready) {
          els.groupSelect.innerHTML = '<option value="">Aguardando WhatsApp ficar pronto</option>';
          initialGroupsLoaded = true;
          updateAppReadinessGate(latestStatusData);
          return [];
        }

        const data = await withTimeout(fetchJson("/api/groups"), 30000);
        if (data?.waiting) {
          els.groupSelect.innerHTML = '<option value="">Aguardando WhatsApp ficar pronto</option>';
          initialGroupsLoaded = true;
          updateAppReadinessGate(latestStatusData);
          return [];
        }
        const groups = Array.isArray(data?.groups) ? data.groups : [];
        const options = ['<option value="">Selecione um grupo</option>'].concat(
          groups.map((group) =>
            '<option value="' + escapeHtml(group.id) + '" data-name="' + escapeHtml(group.name) + '">' + escapeHtml(group.name) + '</option>'
          )
        );
        els.groupSelect.innerHTML = options.join("");
        if (!groups.length) {
          els.groupSelect.innerHTML = '<option value="">Nenhum grupo encontrado nesta sessão</option>';
        }

        const currentGroupId = getGroupIdValue();
        if (currentGroupId) {
          els.groupSelect.value = currentGroupId;
        } else if (els.groupName.value) {
          const option = Array.from(els.groupSelect.options).find((item) => item.dataset.name === els.groupName.value);
          if (option) {
            els.groupSelect.value = option.value;
          }
        }
        initialGroupsLoaded = true;
        updateAppReadinessGate(latestStatusData);
      } catch (error) {
        const message = String(error?.message || "");
        if (message.toLowerCase().includes("não está pronto")) {
          els.groupSelect.innerHTML = '<option value="">Aguardando WhatsApp ficar pronto</option>';
          setLog("Aguardando WhatsApp ficar pronto para listar grupos.");
        } else {
          els.groupSelect.innerHTML = '<option value="">Falha ao carregar grupos</option>';
          setLog("Falha ao carregar grupos: " + (error.message || "erro desconhecido"), true);
        }
        initialGroupsLoaded = true;
        updateAppReadinessGate(latestStatusData);
        return [];
      } finally {
        isLoadingGroups = false;
      }
    }

    async function saveDestination(autoMessage) {
      const data = await fetchJson("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: els.to.value,
          groupId: getGroupIdValue(),
          groupName: els.groupName.value
        })
      });
      destinationSnapshot = getDestinationFormState();
      updateSaveButtonsState();
      setLog(autoMessage || data.message || "Destino salvo.");
      return data;
    }

    function hideAppLoading() {
      if (!loadingEl || appReadyShown) return;
      const elapsed = Date.now() - appLoadingStartedAt;
      const remaining = Math.max(0, MIN_APP_LOADING_MS - elapsed);

      if (remaining > 0) {
        if (appLoadingHideTimer) return;
        appLoadingHideTimer = setTimeout(() => {
          appLoadingHideTimer = null;
          hideAppLoading();
        }, remaining);
        return;
      }

      appReadyShown = true;
      loadingEl.classList.add("hidden");
    }

    function forceHideAppLoading() {
      if (!loadingEl) return;
      if (appLoadingHideTimer) {
        clearTimeout(appLoadingHideTimer);
        appLoadingHideTimer = null;
      }
      appReadyShown = true;
      loadingEl.classList.add("hidden");
    }

    function showAppLoading(title, text) {
      if (!loadingEl) return;
      if (appLoadingHideTimer) {
        clearTimeout(appLoadingHideTimer);
        appLoadingHideTimer = null;
      }
      if (loadingEl.classList.contains("hidden")) {
        appLoadingStartedAt = Date.now();
      }
      if (loadingTitleEl) {
        loadingTitleEl.textContent = title || "Carregando aplicação";
      }
      if (loadingTextEl) {
        loadingTextEl.textContent = text || "Aguarde enquanto inicializamos o painel.";
      }
      loadingEl.classList.remove("hidden");
    }

    function renderLoadingChecklist(data, pending = []) {
      if (!loadingChecklistEl) return;
      const phase = data?.whatsapp?.phase || "";
      const phaseLabel = statusEmPortugues(phase || "carregando");
      const pendingSet = new Set(pending);
      const hasAgendaPending = pendingSet.has("Pelo menos 1 item de agenda");
      const hasConfigPending = pendingSet.has("Turma") || pendingSet.has("Instituição") || pendingSet.has("Pelo menos 1 aluno");

      const items = [
        { label: "Dados de status", done: initialStatusLoaded },
        { label: "Grupos do WhatsApp (opcional)", done: initialGroupsLoaded },
        { label: "Status WhatsApp (" + phaseLabel + ")", done: phase === "ready" || phase === "authenticated" },
        { label: "Itens da agenda", done: initialStatusLoaded && !hasAgendaPending },
        { label: "Configuração obrigatória", done: initialStatusLoaded && !hasConfigPending }
      ];

      loadingChecklistEl.innerHTML = items.map((item) =>
        '<div class="app-loading-item ' + (item.done ? "done" : "") + '">' +
          '<span class="app-loading-icon">' + (item.done ? "✓" : "•") + '</span>' +
          '<span>' + item.label + '</span>' +
        '</div>'
      ).join("");
    }

    function isValidLesson(aula) {
      if (!aula || typeof aula !== "object") return false;
      const dia = String(aula.dia ?? "");
      const hora = normalizeText(aula.hora);
      const materia = normalizeText(aula.materia);
      const professor = normalizeText(aula.professor);
      return ["0", "1", "2", "3", "4", "5", "6"].includes(dia) && !!hora && !!materia && !!professor;
    }

    function getPendingRequiredItems(data) {
      const pending = [];
      const config = data?.config || {};
      if (!normalizeText(config.turma)) pending.push("Turma");
      if (!normalizeText(config.instituicao)) pending.push("Instituição");

      const alunos = Array.isArray(config.alunos) ? config.alunos.map(normalizeText).filter(Boolean) : [];
      if (!alunos.length) pending.push("Pelo menos 1 aluno");

      const lessons = [];
      Object.entries(config.agendaSemanal || {}).forEach(([dia, aulas]) => {
        const list = Array.isArray(aulas) ? aulas : [aulas];
        list.forEach((aula) => {
          lessons.push({
            dia,
            hora: aula?.hora,
            materia: aula?.materia,
            professor: aula?.professor
          });
        });
      });

      const hasValidLesson = lessons.some(isValidLesson);
      if (!hasValidLesson) pending.push("Pelo menos 1 item de agenda");
      return pending;
    }

    function areMainCardsHydrated() {
      const statusText = String(els.statusLines?.textContent || "").trim();
      const nextGreetingsText = String(els.nextGreetings?.textContent || "").trim();
      return Boolean(statusText) && Boolean(nextGreetingsText);
    }

    function updateAppReadinessGate(data) {
      if (appReadyShown) return;
      const cardsHydrated = areMainCardsHydrated();
      const phase = String(data?.whatsapp?.phase || "");
      const needsQrLogin = shouldShowWhatsAppLogin(phase);

      if (needsQrLogin) {
        renderLoadingChecklist(data, []);
        showAppLoading("Aguardando login do WhatsApp", "Escaneie o QR Code para continuar.");
        hideAppLoading();
        return;
      }

      if (cardsHydrated) {
        renderLoadingChecklist(data, []);
        showAppLoading("Finalizando carregamento", "Quase pronto...");
        hideAppLoading();
        return;
      }

      if (!initialStatusLoaded) {
        const waiting = [];
        if (!initialStatusLoaded) waiting.push("status");
        renderLoadingChecklist(data, []);
        showAppLoading(
          "Carregando aplicação",
          "Aguardando: " + waiting.join(" e ") + "."
        );
        return;
      }
      if (!data) {
        renderLoadingChecklist(data, []);
        showAppLoading("Carregando aplicação", "Aguardando dados iniciais do painel.");
        return;
      }
      const whatsappReady = phase === "ready" || phase === "authenticated";
      const pending = getPendingRequiredItems(data);
      renderLoadingChecklist(data, pending);
      if (!whatsappReady) {
        showAppLoading(
          "Aguardando WhatsApp ficar pronto",
          "Status atual: " + statusEmPortugues(phase || "desconhecido") + "."
        );
        return;
      }
      if (!cardsHydrated) {
        showAppLoading(
          "Carregando cartões principais",
          "Aguardando preenchimento de Status e Próximas saudações."
        );
        return;
      }
      hideAppLoading();
    }

    onById("btn-refresh", "click", async (event) => {
      await runWithBusyButton(event.currentTarget, async () => {
        await refresh();
        await loadGroups();
        setLog("Atualizado.");
      });
    });
    if (btnWaReconnect) btnWaReconnect.addEventListener("click", async () => {
      await requestWhatsAppReconnect();
    });

    onById("btn-test", "click", async (event) => {
      await runWithBusyButton(event.currentTarget, async () => {
        setLog("Enviando teste...");
        try {
          const data = await fetchJson("/api/send-test", { method: "POST" });
          setLog(data.message);
          await refresh();
        } catch (error) {
          setLog(error.message, true);
        }
      });
    });

    onById("btn-cancel-lesson-edit", "click", () => {
      editingLessonIndex = -1;
      refreshLessonActionButtons();
      clearLessonInputs();
      renderModalLessons();
      setLog("Edição de aula cancelada.");
    });

    if (modalEls.studentName) {
      modalEls.studentName.addEventListener("input", () => {
        clearInvalidField(modalEls.studentName);
        updateAddStudentButtonState();
      });
    }

    [modalEls.dia, modalEls.hora, modalEls.titulo, modalEls.materia, modalEls.professor].filter(Boolean).forEach((field) => {
      field.addEventListener("input", () => {
        clearInvalidField(field);
        updateAddLessonButtonState();
      });
      field.addEventListener("change", () => {
        clearInvalidField(field);
        updateAddLessonButtonState();
      });
    });

    onById("btn-add-student", "click", async () => {
      const name = normalizeText(modalEls.studentName?.value || "");
      if (!isValidStudentName(name)) {
        markInvalidField(modalEls.studentName, "Nome de aluno inválido.");
        return;
      }
      modalData.alunos.push(name);
      try {
        await persistAgendaFromModal("Aluno adicionado.");
        clearStudentInput();
        refreshStudentActionButtons();
      } catch (error) {
        setLog(error.message || "Falha ao adicionar aluno.", true);
      }
    });

    onById("btn-save-student-edit", "click", async () => {
      if (editingStudentIndex < 0) return;
      const name = normalizeText(modalEls.studentName?.value || "");
      if (!isValidStudentName(name)) {
        markInvalidField(modalEls.studentName, "Nome de aluno inválido.");
        return;
      }
      modalData.alunos[editingStudentIndex] = name;
      try {
        await persistAgendaFromModal("Aluno atualizado.");
        editingStudentIndex = -1;
        clearStudentInput();
        refreshStudentActionButtons();
      } catch (error) {
        setLog(error.message || "Falha ao salvar aluno.", true);
      }
    });

    if (modalEls.students) {
      modalEls.students.addEventListener("click", async (event) => {
        const editIdx = event.target?.dataset?.editStudent;
        const removeIdx = event.target?.dataset?.removeStudent;

        if (editIdx !== undefined) {
          const idx = Number(editIdx);
          if (!Number.isInteger(idx) || idx < 0 || idx >= modalData.alunos.length) return;
          editingStudentIndex = idx;
          modalEls.studentName.value = String(modalData.alunos[idx] || "");
          clearInvalidField(modalEls.studentName);
          refreshStudentActionButtons();
          return;
        }

        if (removeIdx !== undefined) {
          const idx = Number(removeIdx);
          if (!Number.isInteger(idx) || idx < 0 || idx >= modalData.alunos.length) return;
          const removed = String(modalData.alunos[idx] || "");
          const confirmed = await openConfirmModal({
            title: "Excluir aluno",
            message: 'Deseja realmente excluir o aluno "' + removed + '" da lista?',
            confirmLabel: "Excluir aluno"
          });
          if (!confirmed) return;
          modalData.alunos.splice(idx, 1);
          try {
            await persistAgendaFromModal("Aluno removido.");
            if (editingStudentIndex === idx) {
              editingStudentIndex = -1;
              clearStudentInput();
            } else if (editingStudentIndex > idx) {
              editingStudentIndex -= 1;
            }
            refreshStudentActionButtons();
          } catch (error) {
            setLog(error.message || "Falha ao remover aluno.", true);
          }
        }
      });
    }

    onById("btn-add-lesson", "click", async () => {
      const lesson = validateLessonFormAndMark();
      if (!lesson) return;
      modalData.lessons.push(lesson);
      try {
        await persistAgendaFromModal("Aula adicionada.");
        clearLessonInputs();
        editingLessonIndex = -1;
        refreshLessonActionButtons();
      } catch (error) {
        setLog(error.message || "Falha ao adicionar aula.", true);
      }
    });

    onById("btn-save-lesson-edit", "click", async () => {
      if (editingLessonIndex < 0) return;
      const lesson = validateLessonFormAndMark();
      if (!lesson) return;
      modalData.lessons[editingLessonIndex] = lesson;
      try {
        await persistAgendaFromModal("Aula atualizada.");
        editingLessonIndex = -1;
        clearLessonInputs();
        refreshLessonActionButtons();
      } catch (error) {
        setLog(error.message || "Falha ao salvar aula.", true);
      }
    });

    if (modalEls.lessons) {
      modalEls.lessons.addEventListener("click", async (event) => {
        const editIdx = event.target?.dataset?.editLesson;
        const removeIdx = event.target?.dataset?.removeLesson;

        if (editIdx !== undefined) {
          const idx = Number(editIdx);
          if (!Number.isInteger(idx) || idx < 0 || idx >= modalData.lessons.length) return;
          editingLessonIndex = idx;
          fillLessonForm(modalData.lessons[idx]);
          refreshLessonActionButtons();
          return;
        }

        if (removeIdx !== undefined) {
          const idx = Number(removeIdx);
          if (!Number.isInteger(idx) || idx < 0 || idx >= modalData.lessons.length) return;
          const lesson = modalData.lessons[idx] || {};
          const dayNames = {
            "0": "Domingo",
            "1": "Segunda",
            "2": "Terça",
            "3": "Quarta",
            "4": "Quinta",
            "5": "Sexta",
            "6": "Sábado"
          };
          const dayLabel = dayNames[String(lesson?.dia ?? "")] || "Dia";
          const lessonLabel = [
            dayLabel,
            String(lesson?.hora || "").trim(),
            String(lesson?.titulo || "").trim(),
            String(lesson?.materia || "").trim()
          ]
            .filter(Boolean)
            .join(" | ");
          const confirmed = await openConfirmModal({
            title: "Excluir aula",
            message: lessonLabel
              ? 'Deseja realmente excluir esta aula?\\n' + lessonLabel
              : "Deseja realmente excluir esta aula?",
            confirmLabel: "Excluir aula"
          });
          if (!confirmed) return;
          modalData.lessons.splice(idx, 1);
          try {
            await persistAgendaFromModal("Aula removida.");
            if (editingLessonIndex === idx) {
              editingLessonIndex = -1;
              clearLessonInputs();
            } else if (editingLessonIndex > idx) {
              editingLessonIndex -= 1;
            }
            refreshLessonActionButtons();
          } catch (error) {
            setLog(error.message || "Falha ao remover aula.", true);
          }
        }
      });
    }

    onById("btn-now", "click", async (event) => {
      if (isManualSendBusy) return;
      if (event?.currentTarget?.disabled) {
        setLog("Sem ciclo ativo. Inicie um novo ciclo para enviar agora.", true);
        return;
      }
      await runWithBusyButton(event.currentTarget, async () => {
        setLog("Enviando mensagem do dia...");
        isManualSendBusy = true;
        updateManualSendButtonsState();
        try {
          const data = await fetchJson("/api/send-now", { method: "POST" });
          setLog(data.message);
          await refresh();
        } catch (error) {
          setLog(error.message, true);
        } finally {
          isManualSendBusy = false;
          updateManualSendButtonsState();
        }
      });
    });

    onById("btn-now-forced", "click", async (event) => {
      if (isManualSendBusy) return;
      if (event?.currentTarget?.disabled) {
        setLog("Sem ciclo ativo. Inicie um novo ciclo para envio forçado.", true);
        return;
      }
      await runWithBusyButton(event.currentTarget, async () => {
        setLog("Enviando mensagem forçada...");
        isManualSendBusy = true;
        updateManualSendButtonsState();
        try {
          const data = await fetchJson("/api/send-now-forced", { method: "POST" });
          setLog(data.message);
          await refresh();
        } catch (error) {
          setLog(error.message, true);
        } finally {
          isManualSendBusy = false;
          updateManualSendButtonsState();
        }
      });
    });

    if (btnLockNow) btnLockNow.addEventListener("click", () => {
      if (!lockConfigured) {
        setLog("Defina uma senha de bloqueio na Configuração para usar este recurso.", true);
        return;
      }
      lockScreen("Painel bloqueado manualmente.");
    });

    if (btnUnlock) btnUnlock.addEventListener("click", async () => {
      const password = String(lockInputEl.value || "");
      if (!password) {
        setLockFeedback("Digite a senha.", "error");
        return;
      }
      btnUnlock.disabled = true;
      try {
        await fetchJson("/api/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password })
        });
        unlockScreen();
        setLog("Painel desbloqueado.");
      } catch (error) {
        setLockFeedback(error.message || "Senha inválida.", "error");
      } finally {
        btnUnlock.disabled = false;
      }
    });

    if (lockInputEl) lockInputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        btnUnlock.click();
      }
    });

    onById("btn-save-destination", "click", async () => {
      setLog("Salvando destino...");
      try {
        await saveDestination("Destino salvo.");
        await refresh();
      } catch (error) {
        setLog(error.message, true);
      }
    });

    onById("btn-open-editor", "click", async () => {
      await openJsonEditor();
    });

    onById("btn-cancel-easy", "click", () => {
      els.easyEditorWrap.style.display = "none";
      els.jsonEditorWrap.style.display = "none";
      setLog("Editor fechado.");
    });

    onById("btn-open-full-agenda", "click", () => {
      openAgendaModal();
    });
    if (agendaViewEls.closeBtn) {
      agendaViewEls.closeBtn.addEventListener("click", () => closeAgendaModal());
    }
    if (agendaViewEls.wrap) {
      agendaViewEls.wrap.addEventListener("click", (event) => {
        if (event.target === agendaViewEls.wrap) closeAgendaModal();
      });
    }
    if (agendaViewEls.list) {
      agendaViewEls.list.addEventListener("click", async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const revertIdxRaw = target.dataset?.revertEffective;
        if (revertIdxRaw !== undefined) {
          const idx = Number(revertIdxRaw);
          if (!Number.isInteger(idx) || idx < 0 || idx >= agendaItemsCache.length) return;
          const item = agendaItemsCache[idx];
          const aluno = String(item?.alunoPrevisto || "").trim();
          const itemKey = String(target.dataset?.revertKey || "").trim();
          openEffectiveFixModal(idx, itemKey, aluno);
          return;
        }

        const absenceIdxRaw = target.dataset?.markAbsence;
        if (absenceIdxRaw !== undefined) {
          if (target.hasAttribute("disabled")) return;
          const idx = Number(absenceIdxRaw);
          if (!Number.isInteger(idx) || idx < 0 || idx >= agendaItemsCache.length) return;
          const item = agendaItemsCache[idx];
          const pendingIndex = Number(target.dataset?.markAbsencePending);
          const aluno = String(item?.alunoPrevisto || "").trim();
          const confirmed = await openConfirmModal({
            title: "Registrar ausência",
            message: "Confirma ausência deste aluno? Ele será movido para o fim da fila.",
            confirmLabel: "Confirmar ausência"
          });
          if (!confirmed) return;
          try {
            const data = await fetchJson("/api/absence", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ aluno, pendingIndex })
            });
            setLog(data.message || "Ausência registrada.");
            await refresh();
            renderAgendaModal();
          } catch (error) {
            setLog(error.message || "Falha ao registrar ausência.", true);
          }
          return;
        }

        const openSwapRaw = target.dataset?.openSwap;
        if (openSwapRaw !== undefined) {
          openSwapModal(openSwapRaw);
        }
      });
    }

    if (cyclesViewEls.closeBtn) {
      cyclesViewEls.closeBtn.addEventListener("click", () => closeCyclesModal());
    }
    if (cyclesViewEls.filter) {
      cyclesViewEls.filter.addEventListener("change", () => renderCyclesModal());
    }
    if (cyclesViewEls.wrap) {
      cyclesViewEls.wrap.addEventListener("click", (event) => {
        if (event.target === cyclesViewEls.wrap) closeCyclesModal();
      });
    }

    if (confirmEls.cancel) {
      confirmEls.cancel.addEventListener("click", () => closeConfirmModal(false));
    }
    if (confirmEls.ok) {
      confirmEls.ok.addEventListener("click", () => closeConfirmModal(true));
    }
    if (confirmEls.wrap) {
      confirmEls.wrap.addEventListener("click", (event) => {
        if (event.target === confirmEls.wrap) closeConfirmModal(false);
      });
    }

    if (newCycleEls.cancel) {
      newCycleEls.cancel.addEventListener("click", () => closeNewCycleModal());
    }
    if (newCycleEls.wrap) {
      newCycleEls.wrap.addEventListener("click", (event) => {
        if (event.target === newCycleEls.wrap) closeNewCycleModal();
      });
    }
    if (newCycleEls.name) {
      newCycleEls.name.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          newCycleEls.confirm?.click();
        }
      });
    }
    if (newCycleEls.confirm) {
      newCycleEls.confirm.addEventListener("click", async () => {
        const name = String(newCycleEls.name?.value || "").trim();
        setLog("Criando novo ciclo...");
        try {
          const idxAluno = Number(els.startAluno?.value);
          const idxAula = Number(els.startAula?.value);
          const rawDataInicio = String(els.startDate?.value || "").trim();
          const statePayload = {};

          if (Number.isInteger(idxAluno)) {
            statePayload.idxAluno = idxAluno;
          }
          if (Number.isInteger(idxAula)) {
            statePayload.idxAula = idxAula;
          }

          if (rawDataInicio) {
            const parsedDataInicio = parseDateOnly(rawDataInicio);
            if (!parsedDataInicio) {
              markInvalidField(els.startDate, "Data de início inválida.");
              return;
            }
            let idxAulaToSave = Number.isInteger(idxAula) ? idxAula : null;
            const selectedAula = Number.isInteger(idxAula) ? currentScheduleItems[idxAula] : null;
            let dateToSave = parsedDataInicio;

            if (selectedAula && Number(parsedDataInicio.getDay()) !== Number(selectedAula.dia)) {
              const idxByDateWeekday = findFirstLessonIndexByWeekday(parsedDataInicio.getDay());
              if (idxByDateWeekday >= 0) {
                idxAulaToSave = idxByDateWeekday;
                if (els.startAula) {
                  els.startAula.value = String(idxByDateWeekday);
                }
              } else {
                const aligned = alignDateToWeekday(parsedDataInicio, Number(selectedAula.dia));
                if (!aligned) {
                  markInvalidField(els.startDate, "Não foi possível ajustar a data de início.");
                  return;
                }
                dateToSave = aligned;
              }
            }

            const iso = toIsoDateOnly(dateToSave);
            statePayload.dataInicio = iso;
            if (Number.isInteger(Number(idxAulaToSave))) {
              statePayload.idxAula = Number(idxAulaToSave);
            }
            if (els.startDate) {
              els.startDate.value = iso;
            }
            clearInvalidField(els.startDate);
            clearInvalidField(els.startAula);
          }

          if (Object.keys(statePayload).length) {
            await fetchJson("/api/state", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(statePayload)
            });
          }

          const data = await fetchJson("/api/cycle/new", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name })
          });
          closeNewCycleModal();
          setLog(data.message || "Novo ciclo criado.");
          await refresh();
        } catch (error) {
          setLog(error.message, true);
        }
      });
    }

    if (infoEls.ok) {
      infoEls.ok.addEventListener("click", () => closeInfoModal());
    }
    if (infoEls.wrap) {
      infoEls.wrap.addEventListener("click", (event) => {
        if (event.target === infoEls.wrap) closeInfoModal();
      });
    }

    if (swapEls.cancel) {
      swapEls.cancel.addEventListener("click", () => closeSwapModal());
    }
    if (swapEls.wrap) {
      swapEls.wrap.addEventListener("click", (event) => {
        if (event.target === swapEls.wrap) closeSwapModal();
      });
    }
    if (swapEls.confirm) {
      swapEls.confirm.addEventListener("click", async () => {
        if (swapTargetPendingIndex < 0) {
          setLog("Selecione um aluno pendente para troca.", true);
          return;
        }
        const toAluno = String(swapEls.to?.value || "").trim();
        if (!toAluno) {
          setLog("Selecione o aluno de destino para trocar posição.", true);
          return;
        }
        const target = agendaPendingRowsCache.find((item) => item.aluno === toAluno && item.pendingIndex !== swapTargetPendingIndex);
        if (!target) {
          setLog("Aluno de destino não encontrado na fila pendente.", true);
          return;
        }

        try {
          const data = await fetchJson("/api/swap-pending", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fromPendingIndex: swapTargetPendingIndex,
              toPendingIndex: target.pendingIndex,
              fromAluno: swapFromAluno,
              toAluno
            })
          });
          closeSwapModal();
          setLog(data.message || "Troca de posições aplicada.");
          await refresh();
          renderAgendaModal();
        } catch (error) {
          setLog(error.message || "Falha ao trocar posições.", true);
        }
      });
    }

    if (effectiveFixEls.cancel) {
      effectiveFixEls.cancel.addEventListener("click", () => closeEffectiveFixModal());
    }
    if (effectiveFixEls.wrap) {
      effectiveFixEls.wrap.addEventListener("click", (event) => {
        if (event.target === effectiveFixEls.wrap) closeEffectiveFixModal();
      });
    }
    if (effectiveFixEls.confirm) {
      effectiveFixEls.confirm.addEventListener("click", async () => {
        const performer = String(effectiveFixEls.performer?.value || "").trim();
        if (!performer) {
          setLog("Selecione o aluno que realizou a saudação.", true);
          return;
        }
        const linked = getLinkedStudentsFromAgendaItems(true);
        if (!linked.includes(performer)) {
          setLog("Aluno inválido para este ciclo. Selecione um aluno pendente na agenda.", true);
          return;
        }
        const item = agendaItemsCache[effectiveFixContext.index];
        if (!item) {
          setLog("Item de agenda não encontrado para correção.", true);
          return;
        }
        try {
          const data = await fetchJson("/api/revert-effective", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              aluno: effectiveFixContext.alunoPrevisto,
              itemKey: effectiveFixContext.itemKey,
              performedBy: performer
            })
          });
          closeEffectiveFixModal();
          setLog(data.message || "Efetivação corrigida com sucesso.");
          await refresh();
          renderAgendaModal();
        } catch (error) {
          setLog(error.message || "Falha ao corrigir efetivação.", true);
        }
      });
    }

    onById("btn-open-json", "click", async () => {
      try {
        const data = await fetchJson("/api/agenda-json");
        hydrateModalData(data);
        editingStudentIndex = -1;
        editingLessonIndex = -1;
        clearStudentInput();
        clearLessonInputs();
        renderModalStudents();
        renderModalLessons();
        refreshStudentActionButtons();
        refreshLessonActionButtons();
        if (modalEls.wrap) {
          modalEls.wrap.classList.add("open");
          modalEls.wrap.setAttribute("aria-hidden", "false");
        }
      } catch (error) {
        setLog(error.message || "Falha ao abrir editor da agenda.", true);
      }
    });
    onById("btn-close-modal", "click", () => {
      if (modalEls.wrap) {
        modalEls.wrap.classList.remove("open");
        modalEls.wrap.setAttribute("aria-hidden", "true");
      }
    });
    if (modalEls.wrap) {
      modalEls.wrap.addEventListener("click", (event) => {
        if (event.target === modalEls.wrap) {
          modalEls.wrap.classList.remove("open");
          modalEls.wrap.setAttribute("aria-hidden", "true");
        }
      });
    }

    onById("btn-add-easy-aula", "click", () => {
      const row = {
        dia: els.easyDia.value,
        hora: els.easyHora.value.trim(),
        materia: els.easyMateria.value.trim(),
        professor: els.easyProfessor.value.trim()
      };

      if (!row.hora || !row.materia || !row.professor) {
        setLog("Preencha dia, hora, matéria e professor.", true);
        return;
      }

      easyAgendaRows.push(row);
      renderEasyAgendaTable();
      els.easyHora.value = "";
      els.easyMateria.value = "";
      els.easyProfessor.value = "";
      setLog("Aula adicionada.");
    });

    if (els.easyAgendaTable) {
      els.easyAgendaTable.addEventListener("click", (event) => {
        const idx = event.target?.dataset?.removeRow;
        if (idx === undefined) return;
        easyAgendaRows.splice(Number(idx), 1);
        renderEasyAgendaTable();
        setLog("Aula removida.");
      });
    }

    onById("btn-save-easy", "click", async () => {
      setLog("Salvando...");
      try {
        const alunos = els.easyAlunos.value.split("\\n").map((v) => v.trim()).filter(Boolean);
        const payload = {
          alunos,
          agendaSemanal: agendaSemanalFromRows(easyAgendaRows)
        };

        els.agendaJson.value = JSON.stringify(payload, null, 2);
        await fetchJson("/api/agenda-json", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        setLog("Salvo com sucesso.");
        await refresh();
      } catch (error) {
        setLog(error.message, true);
      }
    });

    onById("btn-save-json", "click", async () => {
      setLog("Salvando JSON...");
      try {
        const payload = JSON.parse(els.agendaJson.value);
        const data = await fetchJson("/api/agenda-json", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        setLog(data.message);
        await refresh();
      } catch (error) {
        setLog(error.message, true);
      }
    });

    onById("btn-save-config", "click", async () => {
      setLog("Salvando configuração...");
      try {
        const lockTimeoutMin = Number(els.lockTimeoutMin.value || 15);
        if (!Number.isFinite(lockTimeoutMin) || lockTimeoutMin < 1 || lockTimeoutMin > 240) {
          markInvalidField(els.lockTimeoutMin, "Tempo de bloqueio inválido. Use entre 1 e 240 minutos.");
          return;
        }
        clearInvalidField(els.lockTimeoutMin);

        const body = {
          turma: els.turma.value,
          instituicao: els.instituicao.value,
          antecedenciaMin: Number(els.antecedenciaMin.value || 0),
          diasUteisApenas: els.diasUteisApenas.value === "true",
          lockTimeoutMin
        };
        const lockPasswordValue = String(els.lockPassword.value || "");
        if (lockPasswordValue) {
          body.lockPassword = lockPasswordValue;
        }
        const data = await fetchJson("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        els.lockPassword.value = "";
        configSnapshot = getConfigFormState();
        updateSaveButtonsState();
        setLog(data.message);
        await refresh();
      } catch (error) {
        setLog(error.message, true);
      }
    });

    if (btnNewCycle) {
      btnNewCycle.addEventListener("click", () => {
        openNewCycleModal();
      });
    }

    if (btnCancelCycle) {
      btnCancelCycle.addEventListener("click", async () => {
        const confirmed = await openConfirmModal({
          title: "Cancelar ciclo ativo",
          message: "Deseja cancelar o ciclo ativo agora? O ciclo será finalizado e um novo poderá ser iniciado.",
          confirmLabel: "Cancelar ciclo"
        });
        if (!confirmed) return;

        setLog("Cancelando ciclo ativo...");
        try {
          const data = await fetchJson("/api/cycle/cancel", { method: "POST" });
          setLog(data.message || "Ciclo cancelado.");
          await refresh();
        } catch (error) {
          setLog(error.message, true);
        }
      });
    }

    if (btnRefreshCyclePending) {
      btnRefreshCyclePending.addEventListener("click", async () => {
        setLog("Atualizando ciclo atual (somente pendentes)...");
        try {
          const data = await fetchJson("/api/cycle/refresh-pending", { method: "POST" });
          setLog(data.message || "Pendentes do ciclo atual atualizados.");
          await refresh();
        } catch (error) {
          setLog(error.message, true);
        }
      });
    }

    onById("btn-save-start-aluno", "click", async () => {
      setLog("Definindo aluno inicial...");
      try {
        const idx = Number(els.startAluno.value);
        if (!Number.isInteger(idx)) {
          throw new Error("Selecione um aluno válido.");
        }

        const data = await fetchJson("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idxAluno: idx })
        });
        setLog(data.message || "Aluno inicial atualizado.");
        await refresh();
      } catch (error) {
        setLog(error.message, true);
      }
    });

    onById("btn-save-start-aula", "click", async () => {
      setLog("Definindo aula inicial...");
      try {
        const idx = Number(els.startAula.value);
        if (!Number.isInteger(idx)) {
          throw new Error("Selecione uma aula válida.");
        }
        const selectedAula = currentScheduleItems[idx];

        const payload = { idxAula: idx };
        const rawDataInicio = String(els.startDate.value || "").trim();
        if (rawDataInicio) {
          const parsedDataInicio = parseDateOnly(rawDataInicio);
          if (!parsedDataInicio) {
            markInvalidField(els.startDate, "Data de início inválida.");
            return;
          }
          let dateToSave = parsedDataInicio;
          if (selectedAula && Number(parsedDataInicio.getDay()) !== Number(selectedAula.dia)) {
            const aligned = alignDateToWeekday(parsedDataInicio, Number(selectedAula.dia));
            if (!aligned) {
              markInvalidField(els.startDate, "Não foi possível ajustar a data de início.");
              return;
            }
            dateToSave = aligned;
            setLog("Data ajustada automaticamente para o dia da aula inicial.");
          }
          const iso = toIsoDateOnly(dateToSave);
          payload.dataInicio = iso;
          els.startDate.value = iso;
          clearInvalidField(els.startDate);
          clearInvalidField(els.startAula);
        }

        const data = await fetchJson("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        setLog(data.message || "Aula inicial atualizada.");
        await refresh();
      } catch (error) {
        setLog(error.message, true);
      }
    });

    onById("btn-save-start-date", "click", async () => {
      setLog("Definindo data de início...");
      try {
        const rawDataInicio = String(els.startDate.value || "").trim();
        const parsedDataInicio = parseDateOnly(rawDataInicio);
        if (!parsedDataInicio) {
          markInvalidField(els.startDate, "Data de início inválida.");
          return;
        }
        const idx = Number(els.startAula.value);
        const selectedAula = Number.isInteger(idx) ? currentScheduleItems[idx] : null;
        let idxToSave = Number.isInteger(idx) ? idx : null;
        let dateToSave = parsedDataInicio;
        if (selectedAula && Number(parsedDataInicio.getDay()) !== Number(selectedAula.dia)) {
          const idxByDateWeekday = findFirstLessonIndexByWeekday(parsedDataInicio.getDay());
          if (idxByDateWeekday >= 0) {
            idxToSave = idxByDateWeekday;
            if (els.startAula) {
              els.startAula.value = String(idxByDateWeekday);
            }
            clearInvalidField(els.startAula);
            setLog("Aula inicial ajustada automaticamente para o mesmo dia da data escolhida.");
          } else {
            const aligned = alignDateToWeekday(parsedDataInicio, Number(selectedAula.dia));
            if (!aligned) {
              markInvalidField(els.startDate, "Não foi possível ajustar a data de início.");
              return;
            }
            dateToSave = aligned;
            setLog("Data ajustada automaticamente para o dia da aula inicial.");
          }
        }
        const dataInicio = toIsoDateOnly(dateToSave);
        els.startDate.value = dataInicio;
        clearInvalidField(els.startDate);
        clearInvalidField(els.startAula);

        const payload = { dataInicio };
        if (Number.isInteger(Number(idxToSave))) {
          payload.idxAula = Number(idxToSave);
        }
        const data = await fetchJson("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        setLog(data.message || "Data de início atualizada.");
        await refresh();
      } catch (error) {
        setLog(error.message, true);
      }
    });

    if (els.startAula) {
      els.startAula.addEventListener("change", () => {
        clearInvalidField(els.startAula);
        clearInvalidField(els.startDate);
        updateStartButtonsState();
      });
    }

    if (els.startDate) {
      els.startDate.addEventListener("change", () => {
        clearInvalidField(els.startDate);
        clearInvalidField(els.startAula);
        updateStartButtonsState();
      });
      els.startDate.addEventListener("input", () => {
        clearInvalidField(els.startDate);
        clearInvalidField(els.startAula);
        updateStartButtonsState();
      });
    }

    if (els.startAluno) {
      els.startAluno.addEventListener("change", updateStartButtonsState);
    }

    [els.to, els.groupName].filter(Boolean).forEach((field) => {
      field.addEventListener("input", updateSaveButtonsState);
      field.addEventListener("change", updateSaveButtonsState);
    });
    [els.groupSelect].filter(Boolean).forEach((field) => {
      field.addEventListener("change", updateSaveButtonsState);
    });

    [els.turma, els.instituicao, els.antecedenciaMin, els.diasUteisApenas, els.lockTimeoutMin].filter(Boolean).forEach((field) => {
      field.addEventListener("input", updateSaveButtonsState);
      field.addEventListener("change", updateSaveButtonsState);
    });
    if (els.lockPassword) {
      els.lockPassword.addEventListener("input", updateSaveButtonsState);
      els.lockPassword.addEventListener("change", updateSaveButtonsState);
    }

    if (els.groupSelect) els.groupSelect.addEventListener("change", async () => {
      if (els.groupSelect.value) {
        const selected = els.groupSelect.options[els.groupSelect.selectedIndex];
        setGroupIdValue(els.groupSelect.value);
        els.groupName.value = selected?.dataset?.name || "";
      } else {
        setGroupIdValue("");
        els.groupName.value = "";
      }

      try {
        await saveDestination("Grupo selecionado e destino salvo.");
      } catch (error) {
        setLog(error.message, true);
      }
    });

    if (els.to) els.to.addEventListener("blur", async () => {
      try {
        clearGroupDestinationFields();
        await saveDestination("Número individual salvo automaticamente.");
      } catch (error) {
        setLog(error.message, true);
      }
    });

    if (els.to) els.to.addEventListener("input", () => {
      clearGroupDestinationFields();
    });

    onById("m-btn-refresh", "click", () => {
      const btn = document.getElementById("btn-refresh");
      if (btn) btn.click();
    });
    onById("m-btn-test", "click", () => {
      const btn = document.getElementById("btn-test");
      if (btn) btn.click();
    });
    onById("m-btn-now", "click", () => {
      const btn = document.getElementById("btn-now");
      if (btn) btn.click();
    });
    onById("m-btn-now-forced", "click", () => {
      const btn = document.getElementById("btn-now-forced");
      if (btn) btn.click();
    });

    // Exibe feedback de carregamento imediatamente, mesmo em boots rápidos.
    renderLoadingChecklist(null, []);
    showAppLoading("Carregando aplicação", "Iniciando serviços do painel...");
    setTimeout(() => {
      if (!appReadyShown && loadingEl && !loadingEl.classList.contains("hidden")) {
        setLog("Inicialização demorou além do esperado. Liberando painel automaticamente.", true);
        forceHideAppLoading();
      }
    }, MAX_APP_LOADING_MS);

    bindCardAccessModals();

    Promise.all([refresh(), loadGroups()])
      .then(() => {
        // A liberação da tela inicial depende dos dados obrigatórios.
      })
      .catch((error) => {
        setLog(error.message || "Falha ao carregar dados iniciais.", true);
      });
    refreshStudentActionButtons();
    refreshLessonActionButtons();
    startAutoRefreshLoop();
