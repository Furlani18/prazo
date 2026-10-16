/* ==========================================================================
   app.js — lógica do painel
   ========================================================================== */

(() => {
  const listEl = document.getElementById('prazo-list');
  const emptyEl = document.getElementById('empty-state');

  const kpiAtrasados = document.getElementById('kpi-atrasados');
  const kpiHoje = document.getElementById('kpi-hoje');
  const kpiSemana = document.getElementById('kpi-semana');
  const kpiPendentes = document.getElementById('kpi-pendentes');

  const tabs = document.querySelectorAll('.tab');
  const filtroTipo = document.getElementById('filtro-tipo');
  const filtroDisciplina = document.getElementById('filtro-disciplina');
  const ordenarSelect = document.getElementById('ordenar');
  const buscaPrazos = document.getElementById('buscar-prazos');
  const arquivoImportacao = document.getElementById('arquivo-importacao');

  const modalPrazo = document.getElementById('modal-prazo');
  const formPrazo = document.getElementById('form-prazo');
  const modalPrazoTitle = document.getElementById('modal-prazo-title');

  const modalDisciplinas = document.getElementById('modal-disciplinas');
  const formDisciplina = document.getElementById('form-disciplina');
  const disciplinasLista = document.getElementById('disciplinas-lista');
  const listaDisciplinasDatalist = document.getElementById('lista-disciplinas');

  const modalNotas = document.getElementById('modal-notas');
  const formNota = document.getElementById('form-nota');
  const notasLista = document.getElementById('notas-lista');

  let filtroStatusAtual = 'todos';

  const TIPO_LABEL = { prova: 'Prova', trabalho: 'Trabalho', atividade: 'Atividade' };

  // ---------- utilidades de data ----------

  function hojeISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function diffDias(dataISO) {
    const [ay, am, ad] = dataISO.split('-').map(Number);
    const alvo = new Date(ay, am - 1, ad);
    const agora = new Date();
    const hojeSemHora = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const ms = alvo - hojeSemHora;
    return Math.round(ms / 86400000);
  }

  function formatarData(dataISO, hora) {
    const [y, m, d] = dataISO.split('-');
    const base = `${d}/${m}`;
    return hora ? `${base} às ${hora}` : base;
  }

  function statusEfetivo(prazo) {
    if (prazo.status === 'entregue') return 'entregue';
    return diffDias(prazo.data) < 0 ? 'atrasado' : 'pendente';
  }

  // ---------- render ----------

  function popularFiltroDisciplinas() {
    const disciplinas = DB.listarDisciplinas();
    const valorAtual = filtroDisciplina.value;

    filtroDisciplina.innerHTML = '<option value="todas">Todas as disciplinas</option>' +
      disciplinas.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
    listaDisciplinasDatalist.innerHTML = disciplinas.map(d => `<option value="${escapeHtml(d)}">`).join('');

    if ([...filtroDisciplina.options].some(o => o.value === valorAtual)) {
      filtroDisciplina.value = valorAtual;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderKPIs(prazos) {
    let atrasados = 0, hoje = 0, semana = 0, pendentes = 0;
    prazos.forEach(p => {
      const s = statusEfetivo(p);
      if (s === 'entregue') return;
      pendentes++;
      const dif = diffDias(p.data);
      if (s === 'atrasado') atrasados++;
      else if (dif === 0) hoje++;
      else if (dif > 0 && dif <= 7) semana++;
    });
    kpiAtrasados.textContent = atrasados;
    kpiHoje.textContent = hoje;
    kpiSemana.textContent = semana;
    kpiPendentes.textContent = pendentes;
  }

  function renderStamp(prazo) {
    const s = statusEfetivo(prazo);
    if (s === 'entregue') {
      return `<div class="stamp stamp-ok"><span class="stamp-num">OK</span><span class="stamp-unit">entregue</span></div>`;
    }
    const dif = diffDias(prazo.data);
    if (dif < 0) {
      return `<div class="stamp stamp-atrasado"><span class="stamp-num">${Math.abs(dif)}</span><span class="stamp-unit">atrasado</span></div>`;
    }
    if (dif === 0) {
      return `<div class="stamp stamp-hoje"><span class="stamp-num">hoje</span><span class="stamp-unit">é o dia</span></div>`;
    }
    const classe = dif <= 2 ? 'stamp-hoje' : '';
    return `<div class="stamp ${classe}"><span class="stamp-num">${dif}</span><span class="stamp-unit">${dif === 1 ? 'dia' : 'dias'}</span></div>`;
  }

  function renderCard(prazo) {
    const s = statusEfetivo(prazo);
    const entregue = s === 'entregue';

    return `
      <article class="prazo-card ${entregue ? 'is-entregue' : ''}" data-id="${prazo.id}">
        ${renderStamp(prazo)}
        <div class="prazo-body">
          <div class="prazo-top-row">
            <h3 class="prazo-titulo">${escapeHtml(prazo.titulo)}</h3>
            <span class="tag tag-${prazo.tipo}">${TIPO_LABEL[prazo.tipo] || prazo.tipo}</span>
          </div>
          <div class="prazo-meta">
            <span class="disciplina">${escapeHtml(prazo.disciplina)}</span>
            <span class="data-mono">${formatarData(prazo.data, prazo.hora)}</span>
            <span class="prioridade-${prazo.prioridade}"><span class="prioridade-dot"></span>${prazo.prioridade}</span>
          </div>
          ${prazo.observacoes ? `<p class="prazo-obs">${escapeHtml(prazo.observacoes)}</p>` : ''}
        </div>
        <div class="prazo-actions">
          ${entregue
            ? `<button class="icon-btn reabrir" data-action="reabrir">Reabrir</button>`
            : `<button class="icon-btn entregar" data-action="entregar">Marcar entregue</button>`}
          <button class="icon-btn" data-action="editar">Editar</button>
          <button class="icon-btn excluir" data-action="excluir">Excluir</button>
        </div>
      </article>
    `;
  }

  function aplicarFiltrosEOrdenacao(prazos) {
    let lista = prazos.slice();

    if (filtroStatusAtual !== 'todos') {
      lista = lista.filter(p => statusEfetivo(p) === filtroStatusAtual);
    }
    if (filtroTipo.value !== 'todos') {
      lista = lista.filter(p => p.tipo === filtroTipo.value);
    }
    if (filtroDisciplina.value !== 'todas') {
      lista = lista.filter(p => p.disciplina === filtroDisciplina.value);
    }
    const termo = buscaPrazos.value.trim().toLowerCase();
    if (termo) {
      lista = lista.filter(p => [p.titulo, p.disciplina, p.observacoes].some(valor =>
        String(valor || '').toLowerCase().includes(termo)
      ));
    }

    const modo = ordenarSelect.value;
    if (modo === 'data-asc') {
      lista.sort((a, b) => a.data.localeCompare(b.data));
    } else if (modo === 'data-desc') {
      lista.sort((a, b) => b.data.localeCompare(a.data));
    } else if (modo === 'prioridade') {
      const peso = { alta: 0, media: 1, baixa: 2 };
      lista.sort((a, b) => peso[a.prioridade] - peso[b.prioridade] || a.data.localeCompare(b.data));
    }

    return lista;
  }

  function render() {
    const todos = DB.listarPrazos();
    renderKPIs(todos);

    const lista = aplicarFiltrosEOrdenacao(todos);

    if (lista.length === 0) {
      listEl.innerHTML = '';
      emptyEl.hidden = false;
    } else {
      emptyEl.hidden = true;
      listEl.innerHTML = lista.map(renderCard).join('');
    }
  }

  // ---------- modal: prazo ----------

  function abrirModalPrazo(prazo) {
    formPrazo.reset();
    document.getElementById('prazo-id').value = '';

    if (prazo) {
      modalPrazoTitle.textContent = 'Editar prazo';
      document.getElementById('prazo-id').value = prazo.id;
      document.getElementById('prazo-titulo').value = prazo.titulo;
      document.getElementById('prazo-disciplina').value = prazo.disciplina;
      document.getElementById('prazo-tipo').value = prazo.tipo;
      document.getElementById('prazo-data').value = prazo.data;
      document.getElementById('prazo-hora').value = prazo.hora || '';
      document.getElementById('prazo-obs').value = prazo.observacoes || '';
      const radio = formPrazo.querySelector(`input[name="prioridade"][value="${prazo.prioridade}"]`);
      if (radio) radio.checked = true;
    } else {
      modalPrazoTitle.textContent = 'Novo prazo';
      document.getElementById('prazo-data').value = hojeISO();
    }

    popularFiltroDisciplinas();
    modalPrazo.hidden = false;
    document.getElementById('prazo-titulo').focus();
  }

  function fecharModalPrazo() {
    modalPrazo.hidden = true;
  }

  formPrazo.addEventListener('submit', (e) => {
    e.preventDefault();

    const id = document.getElementById('prazo-id').value;
    const disciplina = document.getElementById('prazo-disciplina').value.trim();

    if (disciplina) DB.adicionarDisciplina(disciplina);

    const prazo = {
      id: id || undefined,
      titulo: document.getElementById('prazo-titulo').value.trim(),
      disciplina,
      tipo: document.getElementById('prazo-tipo').value,
      data: document.getElementById('prazo-data').value,
      hora: document.getElementById('prazo-hora').value,
      prioridade: formPrazo.querySelector('input[name="prioridade"]:checked').value,
      observacoes: document.getElementById('prazo-obs').value.trim()
    };

    DB.salvarPrazo(prazo);
    fecharModalPrazo();
    popularFiltroDisciplinas();
    render();
  });

  document.getElementById('btn-novo').addEventListener('click', () => abrirModalPrazo(null));
  document.getElementById('btn-empty-novo').addEventListener('click', () => abrirModalPrazo(null));
  document.getElementById('cancelar-prazo').addEventListener('click', fecharModalPrazo);
  document.getElementById('fechar-modal-prazo').addEventListener('click', fecharModalPrazo);
  modalPrazo.addEventListener('click', (e) => { if (e.target === modalPrazo) fecharModalPrazo(); });

  // ---------- modal: disciplinas ----------

  function renderDisciplinasLista() {
    const disciplinas = DB.listarDisciplinas();
    disciplinasLista.innerHTML = disciplinas.map(d => `
      <li>
        <span>${escapeHtml(d)}</span>
        <button type="button" data-disciplina="${escapeHtml(d)}" aria-label="Remover ${escapeHtml(d)}">&times;</button>
      </li>
    `).join('') || '<li style="color:var(--text-faint);border:none;background:none;">Nenhuma disciplina cadastrada ainda.</li>';
  }

  document.getElementById('btn-disciplinas').addEventListener('click', () => {
    renderDisciplinasLista();
    modalDisciplinas.hidden = false;
  });
  document.getElementById('fechar-modal-disciplinas').addEventListener('click', () => {
    modalDisciplinas.hidden = true;
    popularFiltroDisciplinas();
    render();
  });
  modalDisciplinas.addEventListener('click', (e) => { if (e.target === modalDisciplinas) modalDisciplinas.hidden = true; });

  formDisciplina.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('nova-disciplina');
    DB.adicionarDisciplina(input.value);
    input.value = '';
    renderDisciplinasLista();
  });

  disciplinasLista.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-disciplina]');
    if (!btn) return;
    DB.removerDisciplina(btn.dataset.disciplina);
    renderDisciplinasLista();
  });

  // ---------- modal: notas ----------

  function renderNotasLista() {
    const notas = DB.listarNotas();
    notasLista.innerHTML = notas.map(nota => `
      <li class="nota-item" data-id="${nota.id}">
        <div class="nota-conteudo">
          <strong>${escapeHtml(nota.disciplina)}</strong>
          <div class="nota-bimestres">
            ${nota.bimestres.slice(0, 2).map((valor, indice) => `<span>${indice + 1}º bim.: <b>${valor === null ? '-' : valor.toFixed(1)}</b></span>`).join('')}
          </div>
        </div>
        <div class="nota-media">${calcularMedia(nota.bimestres)}</div>
        <div class="nota-acoes">
          <button type="button" class="icon-btn" data-nota-action="editar">Editar</button>
          <button type="button" class="icon-btn excluir" data-nota-action="excluir">Excluir</button>
        </div>
      </li>
    `).join('') || '<li class="notas-vazia">Nenhuma nota cadastrada ainda.</li>';
  }

  function calcularMedia(bimestres) {
    const preenchidas = bimestres.filter(valor => valor !== null);
    if (preenchidas.length === 0) return '-';
    return (preenchidas.reduce((total, valor) => total + valor, 0) / preenchidas.length).toFixed(1);
  }

  function abrirModalNotas() {
    renderNotasLista();
    formNota.reset();
    document.getElementById('nota-id').value = '';
    document.getElementById('modal-notas-title').textContent = 'Notas';
    document.getElementById('salvar-nota').textContent = 'Salvar notas';
    modalNotas.hidden = false;
    document.getElementById('nota-disciplina').focus();
  }

  function fecharModalNotas() {
    modalNotas.hidden = true;
  }

  document.getElementById('btn-notas').addEventListener('click', abrirModalNotas);
  document.getElementById('fechar-modal-notas').addEventListener('click', fecharModalNotas);
  document.getElementById('cancelar-nota').addEventListener('click', fecharModalNotas);
  modalNotas.addEventListener('click', (e) => { if (e.target === modalNotas) fecharModalNotas(); });

  formNota.addEventListener('submit', (e) => {
    e.preventDefault();
    const bimestres = [1, 2].map(indice => {
      const valor = document.getElementById(`nota-b${indice}`).value;
      return valor === '' ? null : Number(valor);
    });
    DB.salvarNota({
      id: document.getElementById('nota-id').value || undefined,
      disciplina: document.getElementById('nota-disciplina').value.trim(),
      bimestres
    });
    DB.adicionarDisciplina(document.getElementById('nota-disciplina').value);
    abrirModalNotas();
  });

  notasLista.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-nota-action]');
    if (!btn) return;
    const nota = DB.listarNotas().find(item => item.id === btn.closest('.nota-item').dataset.id);
    if (!nota) return;

    if (btn.dataset.notaAction === 'editar') {
      document.getElementById('nota-id').value = nota.id;
      document.getElementById('nota-disciplina').value = nota.disciplina;
      nota.bimestres.slice(0, 2).forEach((valor, indice) => {
        document.getElementById(`nota-b${indice + 1}`).value = valor === null ? '' : valor;
      });
      document.getElementById('modal-notas-title').textContent = 'Editar nota';
      document.getElementById('salvar-nota').textContent = 'Salvar alterações';
      document.getElementById('nota-disciplina').focus();
    } else if (btn.dataset.notaAction === 'excluir' && confirm('Excluir esta nota? Essa ação não pode ser desfeita.')) {
      DB.excluirNota(nota.id);
      renderNotasLista();
    }
  });

  // ---------- ações nos cards ----------

  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const card = e.target.closest('.prazo-card');
    const id = card.dataset.id;
    const acao = btn.dataset.action;

    if (acao === 'entregar') {
      DB.atualizarStatus(id, 'entregue');
      render();
    } else if (acao === 'reabrir') {
      DB.atualizarStatus(id, 'pendente');
      render();
    } else if (acao === 'excluir') {
      if (confirm('Excluir este prazo? Essa ação não pode ser desfeita.')) {
        DB.excluirPrazo(id);
        render();
      }
    } else if (acao === 'editar') {
      const prazo = DB.listarPrazos().find(p => p.id === id);
      if (prazo) abrirModalPrazo(prazo);
    }
  });

  // ---------- filtros ----------

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      filtroStatusAtual = tab.dataset.filterStatus;
      render();
    });
  });

  filtroTipo.addEventListener('change', render);
  filtroDisciplina.addEventListener('change', render);
  ordenarSelect.addEventListener('change', render);
  buscaPrazos.addEventListener('input', render);

  // ---------- backup local ----------

  document.getElementById('btn-exportar').addEventListener('click', () => {
    const arquivo = new Blob([JSON.stringify(DB.exportarDados(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prazo-backup-${hojeISO()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btn-importar').addEventListener('click', () => arquivoImportacao.click());
  arquivoImportacao.addEventListener('change', async () => {
    const arquivo = arquivoImportacao.files[0];
    if (!arquivo) return;
    try {
      const dados = JSON.parse(await arquivo.text());
      DB.importarDados(dados);
      popularFiltroDisciplinas();
      render();
      alert('Backup importado com sucesso.');
    } catch (erro) {
      alert(erro.message || 'Não foi possível importar o backup.');
    } finally {
      arquivoImportacao.value = '';
    }
  });

  // ---------- atalho de teclado ----------
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!modalPrazo.hidden) fecharModalPrazo();
      if (!modalDisciplinas.hidden) modalDisciplinas.hidden = true;
      if (!modalNotas.hidden) fecharModalNotas();
    }
  });

  // ---------- init ----------
  popularFiltroDisciplinas();
  render();
})();
