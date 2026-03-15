export function dashboardStaticHtml() {
  return String.raw`
  <div id="qr-connect-overlay" class="qr-connect-overlay hidden" aria-live="polite">
    <section class="qr-connect-card rounded-[30px] border border-saudacao-700/10 bg-white/95 p-8 text-center shadow-soft-panel backdrop-blur-xl" role="status">
      <div class="loader-dot"></div>
      <h2 class="title-with-icon qr-connect-title mt-4 text-3xl font-black tracking-[-0.03em] text-saudacao-900"><span class="title-icon" aria-hidden="true">🔄</span><span>Acesso em andamento</span></h2>
      <p id="qr-connect-text" class="qr-connect-text mt-3 text-base leading-7 text-saudacao-800/75">QR validado. Carregando e acessando a aplicação...</p>
    </section>
  </div>

  <div id="wa-login-overlay" class="wa-login-overlay hidden" aria-live="polite">
    <section class="wa-login-card rounded-[32px] border border-saudacao-700/10 bg-white/95 p-8 shadow-soft-panel backdrop-blur-xl" role="status">
      <h2 class="title-with-icon wa-login-title text-3xl font-black tracking-[-0.03em] text-saudacao-900"><span class="title-icon" aria-hidden="true">💬</span><span>Login do WhatsApp</span></h2>
      <p id="wa-login-text" class="wa-login-text mt-3 text-base leading-7 text-saudacao-800/75">Aguardando conexão do WhatsApp Web.</p>
      <div class="wa-login-qr-wrap">
        <img id="wa-login-qr" class="wa-login-qr is-hidden" alt="QR Code para login no WhatsApp Web">
        <div id="wa-login-empty" class="muted">QR Code ainda não disponível. Clique em “Gerar QR”.</div>
      </div>
      <div class="wa-login-actions mt-6 flex justify-end">
        <button id="btn-wa-reconnect" class="btn-save rounded-2xl bg-saudacao-700 px-5 py-3 font-semibold text-white shadow-lg shadow-saudacao-900/15 transition hover:bg-saudacao-800">Gerar QR</button>
      </div>
      <div id="wa-login-feedback" class="wa-login-feedback"></div>
    </section>
  </div>

  <div id="app-loading" class="app-loading" aria-live="polite" aria-busy="true">
    <section class="app-loading-card rounded-[30px] border border-saudacao-700/10 bg-white/95 p-8 text-center shadow-soft-panel backdrop-blur-xl" role="status">
      <div class="loader-dot"></div>
      <h2 id="app-loading-title" class="title-with-icon app-loading-title mt-4 text-3xl font-black tracking-[-0.03em] text-saudacao-900"><span class="title-icon" aria-hidden="true">⏳</span><span>Carregando aplicação</span></h2>
      <p id="app-loading-text" class="app-loading-text mt-3 text-base leading-7 text-saudacao-800/75">Aguarde enquanto inicializamos o painel.</p>
      <div id="app-loading-checklist" class="app-loading-checklist mt-5"></div>
    </section>
  </div>

  <nav class="mobile-quick">
    <button id="m-btn-refresh" class="secondary">Atualizar</button>
    <button id="m-btn-test" class="btn-test">Teste</button>
    <button id="m-btn-now" class="btn-now">Agora</button>
    <button id="m-btn-now-forced" class="btn-now">Forçado</button>
  </nav>

  <div id="editor-modal" class="modal-backdrop" aria-hidden="true">
    <section class="modal rounded-[32px] border border-saudacao-700/10 bg-white/95 p-8 shadow-soft-panel backdrop-blur-xl">
      <div class="modal-head flex items-center justify-between gap-4">
        <h2 class="title-with-icon text-3xl font-black tracking-[-0.03em] text-saudacao-900"><span class="title-icon" aria-hidden="true">📅</span><span>Editor de Agenda</span></h2>
        <div class="modal-head-actions flex items-center gap-3">
          <button id="btn-close-modal" class="secondary rounded-2xl border border-saudacao-700/15 bg-white px-4 py-3 font-semibold text-saudacao-800 shadow-sm transition hover:border-saudacao-700/30 hover:bg-saudacao-50">Fechar</button>
        </div>
      </div>

      <div class="grid mt-6">
        <div class="card rounded-[28px] border border-saudacao-700/10 bg-white/80 p-6 shadow-sm">
          <h2 class="title-with-icon text-2xl font-black tracking-[-0.03em] text-saudacao-900"><span class="title-icon" aria-hidden="true">👥</span><span>Alunos</span></h2>
          <div class="row">
            <div style="grid-column: 1 / -1;">
              <label for="modal-student-name">Nome do aluno</label>
              <input id="modal-student-name" placeholder="Ex.: Angelo">
            </div>
          </div>
          <div class="buttons mt-4 flex flex-wrap gap-3">
            <button id="btn-add-student" class="btn-save rounded-2xl bg-saudacao-700 px-5 py-3 font-semibold text-white shadow-lg shadow-saudacao-900/15 transition hover:bg-saudacao-800">Adicionar Aluno</button>
            <button id="btn-save-student-edit" class="secondary is-hidden rounded-2xl border border-saudacao-700/15 bg-white px-5 py-3 font-semibold text-saudacao-800 shadow-sm transition hover:border-saudacao-700/30 hover:bg-saudacao-50">Salvar Edição</button>
          </div>
          <div class="muted-small" style="margin-top:6px;">Para adicionar aluno, preencha corretamente o nome do aluno.</div>
          <div id="modal-students" class="students-list"></div>
        </div>

        <div class="card rounded-[28px] border border-saudacao-700/10 bg-white/80 p-6 shadow-sm">
          <h2 class="title-with-icon text-2xl font-black tracking-[-0.03em] text-saudacao-900"><span class="title-icon" aria-hidden="true">📅</span><span>Aulas da Semana</span></h2>
          <div class="mini-row">
            <select id="modal-dia">
              <option value="" selected disabled>Selecione o dia</option>
              <option value="1">1 - Segunda</option>
              <option value="2">2 - Terça</option>
              <option value="3">3 - Quarta</option>
              <option value="4">4 - Quinta</option>
              <option value="5">5 - Sexta</option>
              <option value="6">6 - Sábado</option>
              <option value="0">0 - Domingo</option>
            </select>
            <input id="modal-hora" type="time" step="60" autocomplete="off">
            <input id="modal-titulo" placeholder="Título da aula">
            <input id="modal-materia" placeholder="Matéria">
            <input id="modal-professor" placeholder="Professor(a)">
          </div>
          <div class="inline-hint-row">
            <div class="buttons flex flex-wrap gap-3">
              <button id="btn-add-lesson" class="btn-save rounded-2xl bg-saudacao-700 px-5 py-3 font-semibold text-white shadow-lg shadow-saudacao-900/15 transition hover:bg-saudacao-800">Adicionar Aula</button>
              <button id="btn-save-lesson-edit" class="secondary is-hidden rounded-2xl border border-saudacao-700/15 bg-white px-5 py-3 font-semibold text-saudacao-800 shadow-sm transition hover:border-saudacao-700/30 hover:bg-saudacao-50">Salvar Edição</button>
              <button id="btn-cancel-lesson-edit" class="secondary is-hidden rounded-2xl border border-saudacao-700/15 bg-white px-5 py-3 font-semibold text-saudacao-800 shadow-sm transition hover:border-saudacao-700/30 hover:bg-saudacao-50">Cancelar</button>
            </div>
            <div class="inline-hint-card">
              <p class="inline-hint inline-hint-title">Editar: clique em ✎, ajuste e salve.</p>
              <p class="muted-small inline-hint-sub">Novo: preencha os campos e clique em Adicionar Aula.</p>
            </div>
          </div>
          <div id="modal-lessons" class="agenda-list"></div>
        </div>
      </div>

    </section>
  </div>

  <div id="confirm-modal" class="modal-backdrop" aria-hidden="true">
    <section class="confirm-modal rounded-[28px] border border-saudacao-700/10 bg-white/95 p-7 shadow-soft-panel backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text">
      <h2 id="confirm-title" class="title-with-icon confirm-title text-3xl font-black tracking-[-0.03em] text-saudacao-900"><span class="title-icon" aria-hidden="true">⚠️</span><span>Confirmar exclusão</span></h2>
      <p id="confirm-text" class="confirm-text mt-3 text-base leading-7 text-saudacao-800/75">Deseja realmente excluir este item?</p>
      <div class="confirm-actions mt-6 flex justify-end gap-3">
        <button id="confirm-cancel" class="secondary rounded-2xl border border-saudacao-700/15 bg-white px-5 py-3 font-semibold text-saudacao-800 shadow-sm transition hover:border-saudacao-700/30 hover:bg-saudacao-50">Cancelar</button>
        <button id="confirm-ok" class="btn-danger rounded-2xl bg-[#a43a2f] px-5 py-3 font-semibold text-white shadow-lg shadow-[#a43a2f]/20 transition hover:bg-[#8c3127]">Excluir</button>
      </div>
    </section>
  </div>

  <div id="new-cycle-modal" class="modal-backdrop" aria-hidden="true">
    <section class="confirm-modal rounded-[28px] border border-saudacao-700/10 bg-white/95 p-7 shadow-soft-panel backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="new-cycle-title" aria-describedby="new-cycle-text">
      <h2 id="new-cycle-title" class="title-with-icon confirm-title text-3xl font-black tracking-[-0.03em] text-saudacao-900"><span class="title-icon" aria-hidden="true">🔁</span><span>Novo ciclo</span></h2>
      <p id="new-cycle-text" class="confirm-text mt-3 text-base leading-7 text-saudacao-800/75">Defina um nome para identificar este ciclo.</p>
      <div>
        <label for="new-cycle-name">Nome do ciclo</label>
        <input id="new-cycle-name" placeholder="Ex.: Módulo 2 - Semana 1">
      </div>
      <div class="confirm-actions mt-6 flex justify-end gap-3">
        <button id="new-cycle-cancel" class="secondary rounded-2xl border border-saudacao-700/15 bg-white px-5 py-3 font-semibold text-saudacao-800 shadow-sm transition hover:border-saudacao-700/30 hover:bg-saudacao-50">Cancelar</button>
        <button id="new-cycle-confirm" class="btn-save rounded-2xl bg-saudacao-700 px-5 py-3 font-semibold text-white shadow-lg shadow-saudacao-900/15 transition hover:bg-saudacao-800">Criar ciclo</button>
      </div>
    </section>
  </div>

  <div id="info-modal" class="modal-backdrop" aria-hidden="true">
    <section class="info-modal rounded-[28px] border border-saudacao-700/10 bg-white/95 p-7 shadow-soft-panel backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="info-title" aria-describedby="info-text">
      <h2 id="info-title" class="title-with-icon info-title text-3xl font-black tracking-[-0.03em] text-saudacao-900"><span class="title-icon" aria-hidden="true">✅</span><span>Alteração concluída</span></h2>
      <p id="info-text" class="info-text mt-3 text-base leading-7 text-saudacao-800/75">Alteração feita com sucesso.</p>
      <div class="info-actions mt-6 flex justify-end">
        <button id="info-ok" class="btn-save rounded-2xl bg-saudacao-700 px-5 py-3 font-semibold text-white shadow-lg shadow-saudacao-900/15 transition hover:bg-saudacao-800">OK</button>
      </div>
    </section>
  </div>

  <div id="destination-unlock-modal" class="modal-backdrop" aria-hidden="true">
    <section class="confirm-modal rounded-[28px] border border-saudacao-700/10 bg-white/95 p-7 shadow-soft-panel backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="destination-unlock-title" aria-describedby="destination-unlock-text">
      <h2 id="destination-unlock-title" class="title-with-icon confirm-title text-3xl font-black tracking-[-0.03em] text-saudacao-900"><span class="title-icon" aria-hidden="true">🔓</span><span>Desbloquear destino</span></h2>
      <p id="destination-unlock-text" class="confirm-text mt-3 text-base leading-7 text-saudacao-800/75">Digite a senha para liberar a seleção do grupo encontrado.</p>
      <div>
        <label for="destination-unlock-password">Senha</label>
        <input id="destination-unlock-password" type="password" placeholder="Senha de desbloqueio">
      </div>
      <div id="destination-unlock-feedback" class="wa-login-feedback"></div>
      <div class="confirm-actions mt-6 flex justify-end gap-3">
        <button id="destination-unlock-cancel" class="secondary rounded-2xl border border-saudacao-700/15 bg-white px-5 py-3 font-semibold text-saudacao-800 shadow-sm transition hover:border-saudacao-700/30 hover:bg-saudacao-50">Cancelar</button>
        <button id="destination-unlock-confirm" class="btn-save rounded-2xl bg-saudacao-700 px-5 py-3 font-semibold text-white shadow-lg shadow-saudacao-900/15 transition hover:bg-saudacao-800">Liberar</button>
      </div>
    </section>
  </div>

  <div id="swap-modal" class="modal-backdrop" aria-hidden="true">
    <section class="swap-modal rounded-[28px] border border-saudacao-700/10 bg-white/95 p-7 shadow-soft-panel backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="swap-title" aria-describedby="swap-text">
      <h2 id="swap-title" class="title-with-icon info-title text-3xl font-black tracking-[-0.03em] text-saudacao-900"><span class="title-icon" aria-hidden="true">👥</span><span>Trocar posição do aluno</span></h2>
      <p id="swap-text" class="info-text mt-3 text-base leading-7 text-saudacao-800/75">Selecione o aluno para trocar a posição no agendamento pendente.</p>
      <div>
        <label for="swap-from">Aluno selecionado</label>
        <input id="swap-from" readonly>
      </div>
      <div>
        <label for="swap-to">Trocar com</label>
        <select id="swap-to">
          <option value="">Selecione</option>
        </select>
      </div>
      <div class="swap-modal-actions mt-6 flex justify-end gap-3">
        <button id="swap-cancel" class="secondary rounded-2xl border border-saudacao-700/15 bg-white px-5 py-3 font-semibold text-saudacao-800 shadow-sm transition hover:border-saudacao-700/30 hover:bg-saudacao-50">Cancelar</button>
        <button id="swap-confirm" class="btn-save rounded-2xl bg-saudacao-700 px-5 py-3 font-semibold text-white shadow-lg shadow-saudacao-900/15 transition hover:bg-saudacao-800">Confirmar troca</button>
      </div>
    </section>
  </div>

  <div id="effective-fix-modal" class="modal-backdrop" aria-hidden="true">
    <section class="swap-modal rounded-[28px] border border-saudacao-700/10 bg-white/95 p-7 shadow-soft-panel backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="effective-fix-title" aria-describedby="effective-fix-text">
      <h2 id="effective-fix-title" class="title-with-icon info-title text-3xl font-black tracking-[-0.03em] text-saudacao-900"><span class="title-icon" aria-hidden="true">👥</span><span>Corrigir efetivação</span></h2>
      <p id="effective-fix-text" class="info-text mt-3 text-base leading-7 text-saudacao-800/75">Informe quem realmente realizou a saudação nesta data. O aluno previsto irá para o fim da fila.</p>
      <p class="info-text mt-2 text-base leading-7 text-saudacao-800/75">Mostrando apenas alunos vinculados ao ciclo ativo.</p>
      <div>
        <label for="effective-fix-expected">Aluno previsto</label>
        <input id="effective-fix-expected" readonly>
      </div>
      <div>
        <label for="effective-fix-performer">Aluno que realizou</label>
        <select id="effective-fix-performer">
          <option value="">Selecione</option>
        </select>
      </div>
      <div class="swap-modal-actions mt-6 flex justify-end gap-3">
        <button id="effective-fix-cancel" class="secondary rounded-2xl border border-saudacao-700/15 bg-white px-5 py-3 font-semibold text-saudacao-800 shadow-sm transition hover:border-saudacao-700/30 hover:bg-saudacao-50">Cancelar</button>
        <button id="effective-fix-confirm" class="btn-save rounded-2xl bg-saudacao-700 px-5 py-3 font-semibold text-white shadow-lg shadow-saudacao-900/15 transition hover:bg-saudacao-800">Confirmar</button>
      </div>
    </section>
  </div>

  <div id="agenda-modal" class="modal-backdrop" aria-hidden="true">
    <section class="agenda-modal rounded-[32px] border border-saudacao-700/10 bg-white/95 p-8 shadow-soft-panel backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="agenda-modal-title">
      <div class="modal-head flex items-center justify-between gap-4">
        <h2 id="agenda-modal-title" class="title-with-icon text-3xl font-black tracking-[-0.03em] text-saudacao-900"><span class="title-icon" aria-hidden="true">📅</span><span>Agendamentos da turma</span></h2>
        <div class="modal-head-actions flex items-center gap-3">
          <button id="btn-send-agenda-list" class="btn-save rounded-2xl bg-saudacao-700 px-5 py-3 font-semibold text-white shadow-lg shadow-saudacao-900/15 transition hover:bg-saudacao-800">Enviar pendentes</button>
          <button id="btn-close-agenda-modal" class="secondary rounded-2xl border border-saudacao-700/15 bg-white px-5 py-3 font-semibold text-saudacao-800 shadow-sm transition hover:border-saudacao-700/30 hover:bg-saudacao-50">Fechar</button>
        </div>
      </div>
      <div id="agenda-modal-list" class="agenda-modal-list mt-6"></div>
    </section>
  </div>

  <div id="cycles-modal" class="modal-backdrop" aria-hidden="true">
    <section class="agenda-modal rounded-[32px] border border-saudacao-700/10 bg-white/95 p-8 shadow-soft-panel backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="cycles-modal-title">
      <div class="modal-head flex items-center justify-between gap-4">
        <h2 id="cycles-modal-title" class="title-with-icon text-3xl font-black tracking-[-0.03em] text-saudacao-900"><span class="title-icon" aria-hidden="true">🔁</span><span>Todos os ciclos</span></h2>
        <div class="modal-head-actions flex items-center gap-3">
          <button id="btn-clear-completed-cycles" class="secondary rounded-2xl border border-saudacao-700/15 bg-white px-5 py-3 font-semibold text-saudacao-800 shadow-sm transition hover:border-saudacao-700/30 hover:bg-saudacao-50">Apagar concluídos</button>
          <button id="btn-close-cycles-modal" class="secondary rounded-2xl border border-saudacao-700/15 bg-white px-5 py-3 font-semibold text-saudacao-800 shadow-sm transition hover:border-saudacao-700/30 hover:bg-saudacao-50">Fechar</button>
        </div>
      </div>
      <div class="cycle-modal-controls mt-6 rounded-[24px] border border-saudacao-700/10 bg-white/80 p-5 shadow-sm">
        <div>
          <label for="cycles-filter">Filtrar por status</label>
          <select id="cycles-filter">
            <option value="all">Todos</option>
            <option value="active">Ativo</option>
            <option value="completed">Concluído</option>
          </select>
        </div>
      </div>
      <div id="cycles-modal-list" class="agenda-modal-list mt-5"></div>
    </section>
  </div>

  <div id="destination-card-modal" class="modal-backdrop" aria-hidden="true">
    <section class="card-content-modal rounded-[32px] border border-saudacao-700/10 bg-white/95 p-8 shadow-soft-panel backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="destination-card-title">
      <div class="card-head flex items-center justify-between gap-4">
        <h2 id="destination-card-title" class="title-with-icon text-3xl font-black tracking-[-0.03em] text-saudacao-900"><span class="title-icon" aria-hidden="true">🎯</span><span>Destino</span></h2>
        <div class="buttons flex items-center gap-3">
          <button id="btn-save-destination" class="btn-save rounded-2xl bg-saudacao-700 px-5 py-3 font-semibold text-white shadow-lg shadow-saudacao-900/15 transition hover:bg-saudacao-800">Salvar Destino</button>
          <button id="btn-close-destination-modal" class="secondary rounded-2xl border border-saudacao-700/15 bg-white px-5 py-3 font-semibold text-saudacao-800 shadow-sm transition hover:border-saudacao-700/30 hover:bg-saudacao-50">Fechar</button>
        </div>
      </div>
      <div class="row mt-6">
        <div>
          <label for="to">Número individual</label>
          <input id="to" placeholder="Ex.: 5511987654321">
        </div>
        <div>
          <label for="groupSelect">Grupo encontrado</label>
          <div class="field-lock-row">
            <select id="groupSelect" disabled>
              <option value="">Carregando...</option>
            </select>
            <button id="btn-unlock-destination" class="secondary field-lock-btn" type="button" aria-label="Desbloquear seleção de grupo">🔒</button>
          </div>
        </div>
      </div>
      <div style="margin-top:12px">
        <label for="groupName">Nome do grupo</label>
        <input id="groupName" placeholder="Nome exato do grupo" readonly>
      </div>
      <input id="groupId" type="hidden">
    </section>
  </div>

  <div id="config-card-modal" class="modal-backdrop" aria-hidden="true">
    <section class="card-content-modal rounded-[32px] border border-saudacao-700/10 bg-white/95 p-8 shadow-soft-panel backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="config-card-title">
      <div class="config-head flex items-center justify-between gap-4">
        <h2 id="config-card-title" class="title-with-icon text-3xl font-black tracking-[-0.03em] text-saudacao-900"><span class="title-icon" aria-hidden="true">⚙️</span><span>Configuração</span></h2>
        <div class="buttons flex flex-wrap items-center gap-3">
          <button id="btn-new-cycle" class="secondary rounded-2xl border border-saudacao-700/15 bg-white px-5 py-3 font-semibold text-saudacao-800 shadow-sm transition hover:border-saudacao-700/30 hover:bg-saudacao-50">Novo Ciclo</button>
          <button id="btn-cancel-cycle" class="secondary rounded-2xl border border-saudacao-700/15 bg-white px-5 py-3 font-semibold text-saudacao-800 shadow-sm transition hover:border-saudacao-700/30 hover:bg-saudacao-50">Cancelar Ciclo</button>
          <button id="btn-refresh-cycle-pending" class="secondary rounded-2xl border border-saudacao-700/15 bg-white px-5 py-3 font-semibold text-saudacao-800 shadow-sm transition hover:border-saudacao-700/30 hover:bg-saudacao-50">Atualizar Pendentes</button>
          <button id="btn-save-config" class="btn-save rounded-2xl bg-saudacao-700 px-5 py-3 font-semibold text-white shadow-lg shadow-saudacao-900/15 transition hover:bg-saudacao-800">Salvar Configuração</button>
          <button id="btn-close-config-modal" class="secondary rounded-2xl border border-saudacao-700/15 bg-white px-5 py-3 font-semibold text-saudacao-800 shadow-sm transition hover:border-saudacao-700/30 hover:bg-saudacao-50">Fechar</button>
        </div>
      </div>
      <div class="row mt-6">
        <div>
          <label for="turma">Turma</label>
          <input id="turma">
        </div>
        <div>
          <label for="instituicao">Instituição</label>
          <input id="instituicao">
        </div>
      </div>
      <div class="row" style="margin-top:12px">
        <div>
          <label for="antecedenciaMin">Antecedência (min)</label>
          <input id="antecedenciaMin" type="number" min="0">
        </div>
        <div>
          <label for="diasUteisApenas">Dias úteis apenas</label>
          <select id="diasUteisApenas">
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </div>
      </div>
      <div class="row" style="margin-top:12px">
        <div>
          <label for="lockPassword">Senha de bloqueio</label>
          <input id="lockPassword" type="password" placeholder="Digite para definir/alterar">
        </div>
        <div>
          <label for="lockTimeoutMin">Tempo para bloqueio (min)</label>
          <input id="lockTimeoutMin" type="number" min="1" max="240" placeholder="Ex.: 15">
        </div>
      </div>
      <div class="inline-field-action">
        <div>
          <label for="startAluno">Aluno inicial dos envios</label>
          <select id="startAluno">
            <option value="">Carregando...</option>
          </select>
        </div>
        <div class="buttons">
          <button id="btn-save-start-aluno" class="secondary">Definir Início</button>
        </div>
      </div>
      <div class="inline-field-action">
        <div>
          <label for="startAula">Aula inicial dos envios</label>
          <select id="startAula">
            <option value="">Carregando...</option>
          </select>
        </div>
        <div class="buttons">
          <button id="btn-save-start-aula" class="secondary">Definir Aula Inicial</button>
        </div>
      </div>
      <div class="inline-field-action">
        <div>
          <label for="startDate">Data de início</label>
          <input id="startDate" type="date">
        </div>
        <div class="buttons">
          <button id="btn-save-start-date" class="secondary">Definir Data</button>
        </div>
      </div>
    </section>
  </div>

  <div id="lock-overlay" class="lock-overlay hidden" aria-live="polite">
    <section class="lock-card rounded-[28px] border border-saudacao-700/10 bg-white/95 p-7 shadow-soft-panel backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="lock-title">
      <h2 id="lock-title" class="title-with-icon lock-title text-3xl font-black tracking-[-0.03em] text-saudacao-900"><span class="title-icon" aria-hidden="true">🔒</span><span>Painel bloqueado</span></h2>
      <p id="lock-text" class="lock-text mt-3 text-base leading-7 text-saudacao-800/75">Digite a senha para continuar.</p>
      <label for="lock-unlock-password">Senha</label>
      <input id="lock-unlock-password" type="password" placeholder="Senha de desbloqueio">
      <div class="lock-actions mt-6 flex justify-end">
        <button id="btn-unlock" class="btn-save rounded-2xl bg-saudacao-700 px-5 py-3 font-semibold text-white shadow-lg shadow-saudacao-900/15 transition hover:bg-saudacao-800">Desbloquear</button>
      </div>
      <div id="lock-feedback" class="wa-login-feedback"></div>
    </section>
  </div>

  <div id="agenda-card-modal" class="modal-backdrop" aria-hidden="true">
    <section class="card-content-modal rounded-[32px] border border-saudacao-700/10 bg-white/95 p-8 shadow-soft-panel backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="agenda-card-title">
      <div class="card-head flex items-center justify-between gap-4">
        <h2 id="agenda-card-title" class="title-with-icon text-3xl font-black tracking-[-0.03em] text-saudacao-900"><span class="title-icon" aria-hidden="true">📅</span><span>Agenda</span></h2>
        <div class="buttons flex items-center gap-3">
          <button id="btn-close-agenda-card-modal" class="secondary rounded-2xl border border-saudacao-700/15 bg-white px-5 py-3 font-semibold text-saudacao-800 shadow-sm transition hover:border-saudacao-700/30 hover:bg-saudacao-50">Fechar</button>
        </div>
      </div>
      <div id="agenda" class="agenda-list muted is-hidden" aria-hidden="true">Carregando...</div>
      <div class="buttons agenda-modal-actions mt-5 flex items-center gap-3">
        <button id="btn-open-full-agenda" class="secondary is-hidden rounded-2xl border border-saudacao-700/15 bg-white px-5 py-3 font-semibold text-saudacao-800 shadow-sm transition hover:border-saudacao-700/30 hover:bg-saudacao-50">Mais</button>
        <button id="btn-open-json" class="secondary rounded-2xl border border-saudacao-700/15 bg-white px-5 py-3 font-semibold text-saudacao-800 shadow-sm transition hover:border-saudacao-700/30 hover:bg-saudacao-50">Editar Agenda</button>
      </div>
      <div id="cycle-info" class="muted-small mt-4"></div>
      <div id="cycle-history" class="cycle-history mt-4 rounded-[24px] border border-saudacao-700/10 bg-white/80 p-5 shadow-sm"></div>
      <div class="last-run-box mt-5 rounded-[24px] border border-saudacao-700/10 bg-white/80 p-5 shadow-sm">
        <h3 class="title-with-icon last-run-title text-2xl font-black tracking-[-0.03em] text-saudacao-900"><span class="title-icon" aria-hidden="true">📤</span><span>Último envio</span></h3>
        <div id="last-run" class="muted">Nenhum envio ainda.</div>
      </div>
    </section>
  </div>

`;
}
