export function dashboardStaticHtml() {
  return String.raw`
  <div id="qr-connect-overlay" class="qr-connect-overlay hidden" aria-live="polite">
    <section class="qr-connect-card" role="status">
      <div class="loader-dot"></div>
      <h2 class="qr-connect-title">Acesso em andamento</h2>
      <p id="qr-connect-text" class="qr-connect-text">QR validado. Carregando e acessando a aplicação...</p>
    </section>
  </div>

  <div id="wa-login-overlay" class="wa-login-overlay hidden" aria-live="polite">
    <section class="wa-login-card" role="status">
      <h2 class="wa-login-title">Login do WhatsApp</h2>
      <p id="wa-login-text" class="wa-login-text">Aguardando conexão do WhatsApp Web.</p>
      <div class="wa-login-qr-wrap">
        <img id="wa-login-qr" class="wa-login-qr is-hidden" alt="QR Code para login no WhatsApp Web">
        <div id="wa-login-empty" class="muted">QR Code ainda não disponível. Clique em “Gerar QR”.</div>
      </div>
      <div class="wa-login-actions">
        <button id="btn-wa-reconnect" class="btn-save">Gerar QR</button>
      </div>
      <div id="wa-login-feedback" class="wa-login-feedback"></div>
    </section>
  </div>

  <div id="app-loading" class="app-loading" aria-live="polite" aria-busy="true">
    <section class="app-loading-card" role="status">
      <div class="loader-dot"></div>
      <h2 id="app-loading-title" class="app-loading-title">Carregando aplicação</h2>
      <p id="app-loading-text" class="app-loading-text">Aguarde enquanto inicializamos o painel.</p>
      <div id="app-loading-checklist" class="app-loading-checklist"></div>
    </section>
  </div>

  <nav class="mobile-quick">
    <button id="m-btn-refresh" class="secondary">Atualizar</button>
    <button id="m-btn-test" class="btn-test">Teste</button>
    <button id="m-btn-now" class="btn-now">Agora</button>
    <button id="m-btn-now-forced" class="btn-now">Forçado</button>
  </nav>

  <div id="editor-modal" class="modal-backdrop" aria-hidden="true">
    <section class="modal">
      <div class="modal-head">
        <h2>Editor de Agenda</h2>
        <div class="modal-head-actions">
          <button id="btn-close-modal" class="secondary">Fechar</button>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <h2>Alunos</h2>
          <div class="row">
            <div style="grid-column: 1 / -1;">
              <label for="modal-student-name">Nome do aluno</label>
              <input id="modal-student-name" placeholder="Ex.: Angelo">
            </div>
          </div>
          <div class="buttons">
            <button id="btn-add-student" class="btn-save">Adicionar Aluno</button>
            <button id="btn-save-student-edit" class="secondary is-hidden">Salvar Edição</button>
          </div>
          <div class="muted-small" style="margin-top:6px;">Para adicionar aluno, preencha corretamente o nome do aluno.</div>
          <div id="modal-students" class="students-list"></div>
        </div>

        <div class="card">
          <h2>Aulas da Semana</h2>
          <div class="mini-row">
            <select id="modal-dia">
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
            <div class="buttons">
              <button id="btn-add-lesson" class="btn-save">Adicionar Aula</button>
              <button id="btn-save-lesson-edit" class="secondary is-hidden">Salvar Edição</button>
              <button id="btn-cancel-lesson-edit" class="secondary is-hidden">Cancelar</button>
            </div>
            <div class="inline-hint">Clique em Editar para carregar uma aula nos campos e salvar as alterações.</div>
          </div>
          <div class="muted-small">Para adicionar aula, preencha corretamente dia, hora, título, matéria e professor.</div>
          <div id="modal-lessons" class="agenda-list" style="margin-top:8px; height:330px; max-height:none; overflow:auto;"></div>
        </div>
      </div>

    </section>
  </div>

  <div id="confirm-modal" class="modal-backdrop" aria-hidden="true">
    <section class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text">
      <h2 id="confirm-title" class="confirm-title">Confirmar exclusão</h2>
      <p id="confirm-text" class="confirm-text">Deseja realmente excluir este item?</p>
      <div class="confirm-actions">
        <button id="confirm-cancel" class="secondary">Cancelar</button>
        <button id="confirm-ok" class="btn-danger">Excluir</button>
      </div>
    </section>
  </div>

  <div id="new-cycle-modal" class="modal-backdrop" aria-hidden="true">
    <section class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="new-cycle-title" aria-describedby="new-cycle-text">
      <h2 id="new-cycle-title" class="confirm-title">Novo ciclo</h2>
      <p id="new-cycle-text" class="confirm-text">Defina um nome para identificar este ciclo.</p>
      <div>
        <label for="new-cycle-name">Nome do ciclo</label>
        <input id="new-cycle-name" placeholder="Ex.: Módulo 2 - Semana 1">
      </div>
      <div class="confirm-actions">
        <button id="new-cycle-cancel" class="secondary">Cancelar</button>
        <button id="new-cycle-confirm" class="btn-save">Criar ciclo</button>
      </div>
    </section>
  </div>

  <div id="info-modal" class="modal-backdrop" aria-hidden="true">
    <section class="info-modal" role="dialog" aria-modal="true" aria-labelledby="info-title" aria-describedby="info-text">
      <h2 id="info-title" class="info-title">Alteração concluída</h2>
      <p id="info-text" class="info-text">Alteração feita com sucesso.</p>
      <div class="info-actions">
        <button id="info-ok" class="btn-save">OK</button>
      </div>
    </section>
  </div>

  <div id="destination-unlock-modal" class="modal-backdrop" aria-hidden="true">
    <section class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="destination-unlock-title" aria-describedby="destination-unlock-text">
      <h2 id="destination-unlock-title" class="confirm-title">Desbloquear destino</h2>
      <p id="destination-unlock-text" class="confirm-text">Digite a senha para liberar a seleção do grupo encontrado.</p>
      <div>
        <label for="destination-unlock-password">Senha</label>
        <input id="destination-unlock-password" type="password" placeholder="Senha de desbloqueio">
      </div>
      <div id="destination-unlock-feedback" class="wa-login-feedback"></div>
      <div class="confirm-actions">
        <button id="destination-unlock-cancel" class="secondary">Cancelar</button>
        <button id="destination-unlock-confirm" class="btn-save">Liberar</button>
      </div>
    </section>
  </div>

  <div id="swap-modal" class="modal-backdrop" aria-hidden="true">
    <section class="swap-modal" role="dialog" aria-modal="true" aria-labelledby="swap-title" aria-describedby="swap-text">
      <h2 id="swap-title" class="info-title">Trocar posição do aluno</h2>
      <p id="swap-text" class="info-text">Selecione o aluno para trocar a posição no agendamento pendente.</p>
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
      <div class="swap-modal-actions">
        <button id="swap-cancel" class="secondary">Cancelar</button>
        <button id="swap-confirm" class="btn-save">Confirmar troca</button>
      </div>
    </section>
  </div>

  <div id="effective-fix-modal" class="modal-backdrop" aria-hidden="true">
    <section class="swap-modal" role="dialog" aria-modal="true" aria-labelledby="effective-fix-title" aria-describedby="effective-fix-text">
      <h2 id="effective-fix-title" class="info-title">Corrigir efetivação</h2>
      <p id="effective-fix-text" class="info-text">Informe quem realmente realizou a saudação nesta data. O aluno previsto irá para o fim da fila.</p>
      <p class="info-text">Mostrando apenas alunos vinculados ao ciclo ativo.</p>
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
      <div class="swap-modal-actions">
        <button id="effective-fix-cancel" class="secondary">Cancelar</button>
        <button id="effective-fix-confirm" class="btn-save">Confirmar</button>
      </div>
    </section>
  </div>

  <div id="agenda-modal" class="modal-backdrop" aria-hidden="true">
    <section class="agenda-modal" role="dialog" aria-modal="true" aria-labelledby="agenda-modal-title">
      <div class="modal-head">
        <h2 id="agenda-modal-title">Agendamentos da turma</h2>
        <div class="modal-head-actions">
          <button id="btn-send-agenda-list" class="btn-save">Enviar pendentes</button>
          <button id="btn-close-agenda-modal" class="secondary">Fechar</button>
        </div>
      </div>
      <div id="agenda-modal-list" class="agenda-modal-list"></div>
    </section>
  </div>

  <div id="cycles-modal" class="modal-backdrop" aria-hidden="true">
    <section class="agenda-modal" role="dialog" aria-modal="true" aria-labelledby="cycles-modal-title">
      <div class="modal-head">
        <h2 id="cycles-modal-title">Todos os ciclos</h2>
        <div class="modal-head-actions">
          <button id="btn-clear-completed-cycles" class="secondary">Apagar concluídos</button>
          <button id="btn-close-cycles-modal" class="secondary">Fechar</button>
        </div>
      </div>
      <div class="cycle-modal-controls">
        <div>
          <label for="cycles-filter">Filtrar por status</label>
          <select id="cycles-filter">
            <option value="all">Todos</option>
            <option value="active">Ativo</option>
            <option value="completed">Concluído</option>
          </select>
        </div>
      </div>
      <div id="cycles-modal-list" class="agenda-modal-list"></div>
    </section>
  </div>

  <div id="destination-card-modal" class="modal-backdrop" aria-hidden="true">
    <section class="card-content-modal" role="dialog" aria-modal="true" aria-labelledby="destination-card-title">
      <div class="card-head">
        <h2 id="destination-card-title">Destino</h2>
        <div class="buttons">
          <button id="btn-save-destination" class="btn-save">Salvar Destino</button>
          <button id="btn-close-destination-modal" class="secondary">Fechar</button>
        </div>
      </div>
      <div class="row">
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
    <section class="card-content-modal" role="dialog" aria-modal="true" aria-labelledby="config-card-title">
      <div class="config-head">
        <h2 id="config-card-title">Configuração</h2>
        <div class="buttons">
          <button id="btn-new-cycle" class="secondary">Novo Ciclo</button>
          <button id="btn-cancel-cycle" class="secondary">Cancelar Ciclo</button>
          <button id="btn-refresh-cycle-pending" class="secondary">Atualizar Pendentes</button>
          <button id="btn-save-config" class="btn-save">Salvar Configuração</button>
          <button id="btn-close-config-modal" class="secondary">Fechar</button>
        </div>
      </div>
      <div class="row">
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
    <section class="lock-card" role="dialog" aria-modal="true" aria-labelledby="lock-title">
      <h2 id="lock-title" class="lock-title">Painel bloqueado</h2>
      <p id="lock-text" class="lock-text">Digite a senha para continuar.</p>
      <label for="lock-unlock-password">Senha</label>
      <input id="lock-unlock-password" type="password" placeholder="Senha de desbloqueio">
      <div class="lock-actions">
        <button id="btn-unlock" class="btn-save">Desbloquear</button>
      </div>
      <div id="lock-feedback" class="wa-login-feedback"></div>
    </section>
  </div>

  <div id="agenda-card-modal" class="modal-backdrop" aria-hidden="true">
    <section class="card-content-modal" role="dialog" aria-modal="true" aria-labelledby="agenda-card-title">
      <div class="card-head">
        <h2 id="agenda-card-title">Agenda</h2>
        <div class="buttons">
          <button id="btn-close-agenda-card-modal" class="secondary">Fechar</button>
        </div>
      </div>
      <div id="agenda" class="agenda-list muted is-hidden" aria-hidden="true">Carregando...</div>
      <div class="buttons agenda-modal-actions">
        <button id="btn-open-full-agenda" class="secondary is-hidden">Mais</button>
        <button id="btn-open-json" class="secondary">Editar Agenda</button>
      </div>
      <div id="cycle-info" class="muted-small" style="margin-top:8px;"></div>
      <div id="cycle-history" class="cycle-history"></div>
      <div class="last-run-box">
        <h3 class="last-run-title">Último envio</h3>
        <div id="last-run" class="muted">Nenhum envio ainda.</div>
      </div>
    </section>
  </div>

`;
}
