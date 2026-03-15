export function dashboardSkeleton(lines = ["long", "medium", "long"]) {
  return (
    '<div class="loading-skeleton">' +
      lines.map((size) => '<span class="skeleton-line ' + size + '"></span>').join("") +
    "</div>"
  );
}

export function dashboardQuickAccessButton(id, icon, title, subtitle) {
  return (
    '<button id="' + id + '" class="card-access-btn group relative overflow-hidden rounded-[28px] border border-saudacao-700/10 bg-gradient-to-br from-saudacao-700 via-saudacao-700 to-saudacao-600 px-5 py-5 text-left text-white shadow-soft-panel transition duration-200 hover:-translate-y-0.5 hover:shadow-xl">' +
      '<span class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_36%)] opacity-80"></span>' +
      '<span class="relative flex items-center gap-4">' +
        '<span class="card-access-icon flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-2xl shadow-inner">' + icon + "</span>" +
        '<span class="card-access-copy flex min-w-0 flex-col">' +
          '<strong class="text-xl font-semibold tracking-tight">' + title + "</strong>" +
          '<small class="mt-1 text-sm text-white/75">' + subtitle + "</small>" +
        "</span>" +
      "</span>" +
    "</button>"
  );
}

export function dashboardSidebarButton(id, icon, title, subtitle) {
  return (
    '<button id="' + id + '" class="sidebar-nav-btn group mr-auto flex w-[86%] items-center gap-3 rounded-[20px] border border-saudacao-700/10 bg-white/80 px-3 py-2.5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-saudacao-700/20 hover:bg-saudacao-50 hover:shadow-lg" data-tooltip="' + title + '" title="' + title + '" aria-label="' + title + '">' +
      '<span class="sidebar-nav-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-saudacao-700 text-xl text-white shadow-lg shadow-saudacao-900/15">' + icon + "</span>" +
      '<span class="sidebar-nav-copy min-w-0">' +
        '<strong class="sidebar-nav-title block text-[19px] font-bold tracking-[-0.02em] text-saudacao-900">' + title + "</strong>" +
        '<small class="sidebar-nav-subtitle mt-0.5 block text-xs leading-4 text-saudacao-700/70">' + subtitle + "</small>" +
      "</span>" +
    "</button>"
  );
}

export function dashboardHeroHtml() {
  return `
    <section class="hero sticky top-2 z-30 relative overflow-hidden rounded-[24px] border border-saudacao-700/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.97),rgba(241,248,239,0.9))] px-5 py-2 shadow-soft-panel backdrop-blur-xl">
      <div class="absolute inset-y-0 right-[-10rem] w-72 rounded-full bg-[radial-gradient(circle,rgba(246,216,141,0.16),rgba(246,216,141,0))]"></div>
      <div class="relative lg:min-h-[84px]">
        <div class="hero-brand flex flex-col gap-2 lg:w-full lg:h-full">
          <div class="hero-copy-wrap flex items-start gap-4 min-w-0 lg:pr-[420px]">
            <div class="hero-logo shrink-0" aria-hidden="true"><span class="hero-logo-mark">SB</span></div>
            <div class="hero-copy min-w-0">
            <h1 class="hero-title mt-0.5 text-2xl font-black tracking-[-0.03em] text-saudacao-900 xl:text-[2.2rem]">Saudação Bot</h1>
            <div class="hero-subtitle mt-0.5 max-w-3xl text-[13px] leading-5 text-saudacao-800/70">Painel de controle da sessão, com definição de destino e envio rápido de mensagens.</div>
            </div>
          </div>
          <div class="hero-meta flex w-full flex-wrap items-center gap-2 lg:absolute lg:right-0 lg:top-[36px] lg:w-auto lg:justify-end">
            <div class="hero-kicker inline-flex w-fit items-center gap-2 rounded-full border border-saudacao-700/10 bg-white/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-saudacao-700">Painel operacional</div>
            <div id="hero-cycle" class="hero-cycle" style="display:none;"></div>
            <div id="hero-user" class="hero-user" style="display:none;">
              <span id="hero-user-avatar" class="hero-user-avatar" aria-hidden="true">👤</span>
              <span id="hero-user-name" class="hero-user-name"></span>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function dashboardMainShellHtml() {
  return `
    <section id="dashboard-main-grid" class="dashboard-grid grid min-h-0 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside id="sidebar-menu" class="sidebar-menu rounded-[28px] border border-saudacao-700/10 bg-white/78 p-4 shadow-soft-panel backdrop-blur-xl">
        <div class="sidebar-toggle-row mb-2 flex justify-end">
          <button id="btn-toggle-sidebar" class="secondary sidebar-toggle-btn" type="button" aria-label="Minimizar menu lateral" aria-expanded="true" title="Minimizar menu">
            <span id="sidebar-toggle-icon" aria-hidden="true">◀</span>
          </button>
        </div>
        <div class="sidebar-collapsed-nav" aria-hidden="true">
          <button id="btn-collapsed-session" class="secondary sidebar-collapsed-btn" type="button" title="Sessão" aria-label="Sessão">🟢</button>
          <button id="btn-collapsed-destination" class="secondary sidebar-collapsed-btn" type="button" title="Destino" aria-label="Destino">📲</button>
          <button id="btn-collapsed-config" class="secondary sidebar-collapsed-btn" type="button" title="Configuração" aria-label="Configuração">⚙️</button>
          <button id="btn-collapsed-agenda" class="secondary sidebar-collapsed-btn" type="button" title="Agenda" aria-label="Agenda">📅</button>
        </div>
        <div class="sidebar-status-block rounded-[20px] border border-saudacao-700/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(243,248,239,0.95))] p-3">
          <span class="mb-1 block text-[10px] font-bold uppercase tracking-[0.2em] text-saudacao-700/65">Status geral</span>
          <div class="flex items-center justify-center">
            <div id="status-badge" class="status shrink-0"><span class="dot"></span><span>Carregando...</span></div>
          </div>
        </div>
        <div class="sidebar-nav mt-3 grid gap-2">
          ${dashboardSidebarButton("btn-focus-session-card", "🟢", "Sessão", "Status e operação")}
          ${dashboardSidebarButton("btn-open-destination-modal", "📲", "Destino", "Grupo, contato e envio")}
          ${dashboardSidebarButton("btn-open-config-modal", "⚙️", "Configuração", "Ciclo, regras e segurança")}
          ${dashboardSidebarButton("btn-open-agenda-card-modal", "📅", "Agenda", "Aulas, histórico e acompanhamento")}
        </div>
        <div class="sidebar-shortcuts mt-3 rounded-[20px] border border-saudacao-700/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(243,248,239,0.95))] px-4 py-4">
          <span class="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-saudacao-700/65">Atalhos</span>
          <div class="grid justify-items-center gap-3">
            <button id="btn-refresh" class="secondary btn-refresh mr-auto ml-2 flex w-[58%] max-w-full items-center gap-2 rounded-xl border border-saudacao-700/15 bg-white px-3 py-2.5 text-left text-sm font-semibold text-saudacao-800 shadow-sm transition hover:border-saudacao-700/30 hover:bg-saudacao-50">
              <span class="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-saudacao-100 text-base text-saudacao-700">↻</span>
              <span>Atualizar</span>
            </button>
            <button id="btn-lock-now" class="secondary mr-auto ml-2 flex w-[58%] max-w-full items-center gap-2 rounded-xl border border-saudacao-700/15 bg-sun-100 px-3 py-2.5 text-left text-sm font-semibold text-saudacao-900 shadow-sm transition hover:border-saudacao-700/30 hover:bg-white">
              <span class="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-saudacao-200 text-base text-saudacao-800">🔒</span>
              <span>Bloquear</span>
            </button>
          </div>
        </div>
      </aside>

      <div class="grid min-h-0 gap-4">
        <div id="session-status-card" class="card lessons-card status-card is-hidden rounded-[30px] border border-saudacao-700/10 bg-white/75 p-6 shadow-soft-panel backdrop-blur-xl">
          <div class="card-head flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <span class="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-saudacao-700/65">Operação</span>
              <h2 class="title-with-icon text-3xl font-black tracking-[-0.03em] text-saudacao-900"><span class="title-icon" aria-hidden="true">🟢</span><span>Status da sessão</span></h2>
            </div>
            <div class="buttons status-actions flex flex-wrap gap-3">
              <button id="btn-test" class="btn-test rounded-2xl bg-saudacao-700 px-4 py-3 font-semibold text-white shadow-lg shadow-saudacao-900/15 transition hover:bg-saudacao-800">Enviar Teste</button>
              <button id="btn-now" class="btn-now rounded-2xl bg-saudacao-700 px-4 py-3 font-semibold text-white shadow-lg shadow-saudacao-900/15 transition hover:bg-saudacao-800">Enviar Agora</button>
              <button id="btn-now-forced" class="btn-now rounded-2xl bg-saudacao-800 px-4 py-3 font-semibold text-white shadow-lg shadow-saudacao-900/20 transition hover:bg-saudacao-900">Enviar Forçado</button>
            </div>
          </div>
          <div class="card-section mt-5 rounded-[24px] border border-saudacao-700/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(243,248,239,0.94))] p-5">
            <span class="section-label mb-3 block text-[11px] font-bold uppercase tracking-[0.22em] text-saudacao-700/65">Saúde do sistema</span>
            <div id="status-lines" class="loading-skeleton" aria-busy="true">${dashboardSkeleton(["long", "medium", "long"])}</div>
          </div>
          <div class="card-section mt-4 rounded-[24px] border border-saudacao-700/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(243,248,239,0.94))] p-5">
            <span class="section-label mb-3 block text-[11px] font-bold uppercase tracking-[0.22em] text-saudacao-700/65">Retorno da última ação</span>
            <div id="action-log" class="log info">Painel iniciado. Aguardando dados.</div>
          </div>
        </div>

        <div id="active-queue-card" class="card card-highlight rounded-[30px] border border-saudacao-700/10 bg-white/75 p-6 shadow-soft-panel backdrop-blur-xl">
          <div class="card-head flex items-center justify-between">
            <div>
              <span class="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-saudacao-700/65">Fila ativa</span>
              <h2 class="title-with-icon text-3xl font-black tracking-[-0.03em] text-saudacao-900"><span class="title-icon" aria-hidden="true">📅</span><span>Próximas saudações</span></h2>
            </div>
          </div>
          <div id="next-greetings" class="next-greetings-box mt-5 rounded-[24px] border border-saudacao-700/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(243,248,239,0.94))] p-5" aria-busy="true">
            ${dashboardSkeleton(["long", "medium", "long", "short"])}
          </div>
        </div>
      </div>
    </section>
  `;
}
