/* ==========================================================================
   db.js — camada de persistência (localStorage)
   ========================================================================== */

const DB = (() => {
  const KEY_PRAZOS = 'prazo_academico_prazos';
  const KEY_DISCIPLINAS = 'prazo_academico_disciplinas';
  const KEY_NOTAS = 'prazo_academico_notas_escolares';
  const KEY_SEED = 'prazo_academico_seeded';

  function _read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('DB: erro ao ler', key, e);
      return fallback;
    }
  }

  function _write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('DB: erro ao salvar', key, e);
    }
  }

  function _uid() {
    return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function _seedIfEmpty() {
    if (_read(KEY_SEED, false)) return;

    const hoje = new Date();
    const addDias = (n) => {
      const d = new Date(hoje);
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    };

    const disciplinasSeed = ['Cálculo II', 'Estrutura de Dados', 'Banco de Dados', 'Engenharia de Software'];

    const prazosSeed = [
      {
        id: _uid(),
        titulo: 'Prova — Unidade 2',
        disciplina: 'Cálculo II',
        tipo: 'prova',
        data: addDias(-1),
        hora: '19:00',
        prioridade: 'alta',
        status: 'pendente',
        observacoes: 'Cai integrais por partes e substituição trigonométrica.',
        criadoEm: new Date().toISOString()
      },
      {
        id: _uid(),
        titulo: 'Trabalho — Árvores AVL',
        disciplina: 'Estrutura de Dados',
        tipo: 'trabalho',
        data: addDias(0),
        hora: '23:59',
        prioridade: 'alta',
        status: 'pendente',
        observacoes: 'Entrega via Moodle, relatório + código.',
        criadoEm: new Date().toISOString()
      },
      {
        id: _uid(),
        titulo: 'Lista de exercícios — Modelagem ER',
        disciplina: 'Banco de Dados',
        tipo: 'atividade',
        data: addDias(4),
        hora: '',
        prioridade: 'media',
        status: 'pendente',
        observacoes: '',
        criadoEm: new Date().toISOString()
      },
      {
        id: _uid(),
        titulo: 'Seminário — Metodologias ágeis',
        disciplina: 'Engenharia de Software',
        tipo: 'trabalho',
        data: addDias(9),
        hora: '14:00',
        prioridade: 'baixa',
        status: 'pendente',
        observacoes: 'Apresentação em grupo, 15 minutos.',
        criadoEm: new Date().toISOString()
      },
      {
        id: _uid(),
        titulo: 'Prova — Unidade 1',
        disciplina: 'Cálculo II',
        tipo: 'prova',
        data: addDias(-12),
        hora: '19:00',
        prioridade: 'media',
        status: 'entregue',
        observacoes: '',
        criadoEm: new Date().toISOString()
      }
    ];

    _write(KEY_DISCIPLINAS, disciplinasSeed);
    _write(KEY_PRAZOS, prazosSeed);
    _write(KEY_SEED, true);
  }

  // ---------- API pública ----------

  function listarPrazos() {
    return _read(KEY_PRAZOS, []);
  }

  function salvarPrazo(prazo) {
    const prazos = listarPrazos();
    if (prazo.id) {
      const idx = prazos.findIndex(p => p.id === prazo.id);
      if (idx >= 0) {
        prazos[idx] = { ...prazos[idx], ...prazo };
      }
    } else {
      prazo.id = _uid();
      prazo.status = prazo.status || 'pendente';
      prazo.criadoEm = new Date().toISOString();
      prazos.push(prazo);
    }
    _write(KEY_PRAZOS, prazos);
    return prazo;
  }

  function excluirPrazo(id) {
    const prazos = listarPrazos().filter(p => p.id !== id);
    _write(KEY_PRAZOS, prazos);
  }

  function atualizarStatus(id, status) {
    const prazos = listarPrazos();
    const idx = prazos.findIndex(p => p.id === id);
    if (idx >= 0) {
      prazos[idx].status = status;
      _write(KEY_PRAZOS, prazos);
    }
  }

  function listarDisciplinas() {
    return _read(KEY_DISCIPLINAS, []);
  }

  function adicionarDisciplina(nome) {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) return;
    const disciplinas = listarDisciplinas();
    if (!disciplinas.some(d => d.toLowerCase() === nomeLimpo.toLowerCase())) {
      disciplinas.push(nomeLimpo);
      _write(KEY_DISCIPLINAS, disciplinas);
    }
  }

  function removerDisciplina(nome) {
    const disciplinas = listarDisciplinas().filter(d => d !== nome);
    _write(KEY_DISCIPLINAS, disciplinas);
  }

  function listarNotas() {
    return _read(KEY_NOTAS, []);
  }

  function salvarNota(nota) {
    const notas = listarNotas();
    const agora = new Date().toISOString();
    if (nota.id) {
      const idx = notas.findIndex(n => n.id === nota.id);
      if (idx >= 0) notas[idx] = { ...notas[idx], ...nota, atualizadoEm: agora };
    } else {
      nota.id = _uid();
      nota.criadoEm = agora;
      nota.atualizadoEm = agora;
      notas.unshift(nota);
    }
    _write(KEY_NOTAS, notas);
    return nota;
  }

  function excluirNota(id) {
    _write(KEY_NOTAS, listarNotas().filter(nota => nota.id !== id));
  }

  function exportarDados() {
    return {
      versao: 1,
      exportadoEm: new Date().toISOString(),
      prazos: listarPrazos(),
      disciplinas: listarDisciplinas(),
      notas: listarNotas()
    };
  }

  function importarDados(dados) {
    if (!dados || !Array.isArray(dados.prazos) || !Array.isArray(dados.disciplinas) || !Array.isArray(dados.notas)) {
      throw new Error('Arquivo de backup inválido.');
    }
    _write(KEY_PRAZOS, dados.prazos);
    _write(KEY_DISCIPLINAS, dados.disciplinas);
    _write(KEY_NOTAS, dados.notas);
  }

  _seedIfEmpty();

  return {
    listarPrazos,
    salvarPrazo,
    excluirPrazo,
    atualizarStatus,
    listarDisciplinas,
    adicionarDisciplina,
    removerDisciplina,
    listarNotas,
    salvarNota,
    excluirNota,
    exportarDados,
    importarDados
  };
})();
