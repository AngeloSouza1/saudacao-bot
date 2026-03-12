export function dashboardSkeleton(lines = ["long", "medium", "long"]) {
  return (
    '<div class="loading-skeleton">' +
      lines.map((size) => '<span class="skeleton-line ' + size + '"></span>').join("") +
    "</div>"
  );
}

export function dashboardQuickAccessButton(id, icon, title, subtitle) {
  return (
    '<button id="' + id + '" class="card-access-btn">' +
      '<span class="card-access-icon">' + icon + "</span>" +
      '<span class="card-access-copy">' +
        "<strong>" + title + "</strong>" +
        "<small>" + subtitle + "</small>" +
      "</span>" +
    "</button>"
  );
}

export function dashboardHeroHtml() {
  return `
    <section class="hero">
      <div class="hero-brand">
        <div class="hero-logo" aria-hidden="true"><span class="hero-logo-mark">SB</span></div>
        <div class="hero-copy">
          <div class="hero-kicker">Painel operacional</div>
          <h1 class="hero-title">Saudação Bot</h1>
          <div class="hero-subtitle">Painel local para sessão, destino e disparo imediato.</div>
          <div class="hero-meta">
            <div id="hero-cycle" class="hero-cycle" style="display:none;"></div>
          </div>
        </div>
      </div>
      <div class="hero-panel">
        <p class="panel-eyebrow">Status geral</p>
        <div id="status-badge" class="status"><span class="dot"></span><span>Carregando...</span></div>
        <div class="hero-panel-text">Acompanhe a sessão, valide o destino e execute ações rápidas sem abrir telas extras.</div>
      </div>
    </section>
  `;
}

export function dashboardMainShellHtml() {
  return `
    <section class="dashboard-grid">
      <div class="card lessons-card status-card">
        <div class="card-head">
          <h2>Status</h2>
          <div class="buttons status-actions">
            <button id="btn-refresh" class="secondary btn-refresh">Atualizar</button>
            <button id="btn-test" class="btn-test">Enviar Teste</button>
            <button id="btn-now" class="btn-now">Enviar Agora</button>
            <button id="btn-now-forced" class="btn-now">Enviar Forçado</button>
            <button id="btn-lock-now" class="secondary">Bloquear</button>
          </div>
        </div>
        <div class="card-section">
          <span class="section-label">Saúde do sistema</span>
          <div id="status-lines" class="loading-skeleton" aria-busy="true">${dashboardSkeleton(["long", "medium", "long"])}</div>
        </div>
        <div class="card-section">
          <span class="section-label">Retorno da última ação</span>
          <div id="action-log" class="log info">Painel iniciado. Aguardando dados.</div>
        </div>
        <div class="card-section">
          <span class="section-label">Acessos rápidos</span>
          <div class="card-access">
            ${dashboardQuickAccessButton("btn-open-destination-modal", "📲", "Destino", "Grupo e contato")}
            ${dashboardQuickAccessButton("btn-open-config-modal", "⚙️", "Configuração", "Ciclo e regras")}
            ${dashboardQuickAccessButton("btn-open-agenda-card-modal", "📅", "Agenda", "Aulas e histórico")}
          </div>
        </div>
      </div>

      <div class="side-stack">
        <div class="card card-highlight">
          <div class="card-head">
            <h2>Próximas saudações</h2>
          </div>
          <div id="next-greetings" class="next-greetings-box" aria-busy="true">
            ${dashboardSkeleton(["long", "medium", "long", "short"])}
          </div>
        </div>
      </div>
    </section>
  `;
}
