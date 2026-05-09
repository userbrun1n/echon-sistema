const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: '*'
}));

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
});

const SECRET = process.env.JWT_SECRET || 'echon-secret-2025';
const ADMIN_SENHA = 'YxTLA8jJxwpv3Ux';

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Sem token' });
  try {
    req.cliente = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido' });
  }
}

function gerarToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = 'echon-';
  for (let i = 0; i < 12; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    const [rows] = await db.query(
      'SELECT * FROM clientes WHERE email = ? AND senha = ?',
      [email, senha]
    );
    if (rows.length === 0) return res.status(401).json({ erro: 'Email ou senha incorretos' });
    const cliente = rows[0];
    const token = jwt.sign({ id: cliente.id, nome: cliente.nome }, SECRET, { expiresIn: '8h' });
    res.json({
      token,
      cliente: {
        id: cliente.id,
        nome: cliente.nome,
        email: cliente.email,
        cor_primaria: cliente.cor_primaria,
        logo_url: cliente.logo_url
      }
    });
  } catch (e) {
    res.status(500).json({ erro: 'Erro no servidor' });
  }
});

// ADMIN: CADASTRAR CLIENTE + SENSORES (múltiplos)
app.post('/api/admin/cadastrar', async (req, res) => {
  try {
    const { nome, email, senha, sensores, adminSenha } = req.body;

    if (adminSenha !== ADMIN_SENHA) {
      return res.status(401).json({ erro: 'Senha de administrador incorreta' });
    }

    if (!nome || !email || !senha || !sensores || !sensores.length) {
      return res.status(400).json({ erro: 'Preencha todos os campos' });
    }

    // Verifica se email já existe
    const [existe] = await db.query(
      'SELECT id FROM clientes WHERE email = ?', [email]
    );
    if (existe.length > 0) {
      return res.status(400).json({ erro: 'Este e-mail já está cadastrado' });
    }

    // Insere cliente
    const [resultado] = await db.query(
      'INSERT INTO clientes (nome, email, senha) VALUES (?, ?, ?)',
      [nome, email, senha]
    );
    const clienteId = resultado.insertId;

    // Insere cada sensor com token único
    const tokens = [];
    for (const sensor of sensores) {
      let token;
      let tokenExiste = true;
      while (tokenExiste) {
        token = gerarToken();
        const [check] = await db.query(
          'SELECT id FROM dispositivos WHERE token = ?', [token]
        );
        tokenExiste = check.length > 0;
      }
      await db.query(
        'INSERT INTO dispositivos (cliente_id, nome, local, token) VALUES (?, ?, ?, ?)',
        [clienteId, sensor.nome, sensor.local, token]
      );
      tokens.push({ nome: sensor.nome, token });
    }

    res.json({ sucesso: true, tokens, clienteId });

  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao cadastrar cliente' });
  }
});


// TROCAR SENHA DO CLIENTE
app.post('/api/cliente/trocar-senha', auth, async (req, res) => {
  try {
    const { senhaAtual, senhaNova } = req.body;
    const clienteId = req.cliente.id;

    if (!senhaAtual || !senhaNova) {
      return res.status(400).json({ erro: 'Preencha todos os campos' });
    }
    if (senhaNova.length < 6) {
      return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 6 caracteres' });
    }

    // Verifica senha atual
    const [rows] = await db.query(
      'SELECT id FROM clientes WHERE id = ? AND senha = ?',
      [clienteId, senhaAtual]
    );
    if (rows.length === 0) {
      return res.status(401).json({ erro: 'Senha atual incorreta' });
    }

    // Atualiza senha
    await db.query(
      'UPDATE clientes SET senha = ? WHERE id = ?',
      [senhaNova, clienteId]
    );

    res.json({ sucesso: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao trocar senha' });
  }
});


// ADMIN: LISTAR TODOS OS CLIENTES
app.get('/api/admin/clientes', auth, async (req, res) => {
  try {
    const [clientes] = await db.query(
      `SELECT c.id, c.nome, c.email, c.criado_em,
              a.nome as ambiente,
              COUNT(d.id) as total_sensores
       FROM clientes c
       LEFT JOIN ambientes a ON a.id = c.ambiente_id
       LEFT JOIN dispositivos d ON d.cliente_id = c.id
       GROUP BY c.id
       ORDER BY c.criado_em DESC`
    );
    res.json(clientes);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }
});


// ADMIN: DESATIVAR CLIENTE (todos os sensores)
app.post('/api/admin/cliente/:id/desativar', async (req, res) => {
  try {
    const { adminSenha } = req.body;
    if (adminSenha !== ADMIN_SENHA) return res.status(401).json({ erro: 'Senha incorreta' });
    await db.query('UPDATE dispositivos SET ativo = 0 WHERE cliente_id = ?', [req.params.id]);
    res.json({ sucesso: true, mensagem: 'Cliente desativado' });
  } catch (e) { res.status(500).json({ erro: 'Erro ao desativar' }); }
});

// ADMIN: REATIVAR CLIENTE (todos os sensores)
app.post('/api/admin/cliente/:id/reativar', async (req, res) => {
  try {
    const { adminSenha } = req.body;
    if (adminSenha !== ADMIN_SENHA) return res.status(401).json({ erro: 'Senha incorreta' });
    await db.query('UPDATE dispositivos SET ativo = 1 WHERE cliente_id = ?', [req.params.id]);
    res.json({ sucesso: true, mensagem: 'Cliente reativado' });
  } catch (e) { res.status(500).json({ erro: 'Erro ao reativar' }); }
});

// ADMIN: STATUS DOS SENSORES DO CLIENTE
app.get('/api/admin/cliente/:id/status', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT COUNT(*) as total, SUM(ativo) as ativos FROM dispositivos WHERE cliente_id = ?',
      [req.params.id]
    );
    const ativo = rows[0].ativos > 0;
    res.json({ ativo, total: rows[0].total, ativos: rows[0].ativos });
  } catch (e) { res.status(500).json({ erro: 'Erro ao buscar status' }); }
});

// DADOS DO DASHBOARD
app.get('/api/dashboard', auth, async (req, res) => {
  try {
    const clienteId = req.cliente.id;

    const [dispositivos] = await db.query(
      'SELECT * FROM dispositivos WHERE cliente_id = ? AND ativo = 1',
      [clienteId]
    );

    if (dispositivos.length === 0) {
      return res.json({ dispositivos: [], medicoes: [], alertas: [], stats: null });
    }

    const ids = dispositivos.map(d => d.id);

    const [medicoes] = await db.query(
      `SELECT m.*, d.nome as dispositivo_nome, d.local as dispositivo_local
       FROM medicoes m
       JOIN dispositivos d ON d.id = m.dispositivo_id
       WHERE m.dispositivo_id IN (?)
       ORDER BY m.registrado_em DESC
       LIMIT 100`,
      [ids]
    );

    const [alertas] = await db.query(
      `SELECT a.*,
              DATE_FORMAT(CONVERT_TZ(a.registrado_em, '+00:00', '-03:00'), '%Y-%m-%dT%H:%i:%s') as registrado_em,
              d.nome as dispositivo_nome
       FROM alertas a
       JOIN dispositivos d ON d.id = a.dispositivo_id
       WHERE a.dispositivo_id IN (?)
       ORDER BY a.registrado_em DESC
       LIMIT 10`,
      [ids]
    );

    const [stats] = await db.query(
      `SELECT
        ROUND(AVG(db_valor), 1) as media,
        ROUND(MAX(db_valor), 1) as pico,
        ROUND(MIN(db_valor), 1) as minimo,
        (SELECT db_valor FROM medicoes WHERE dispositivo_id IN (?) ORDER BY registrado_em DESC LIMIT 1) as atual
       FROM medicoes
       WHERE dispositivo_id IN (?)
       AND registrado_em >= NOW() - INTERVAL 24 HOUR`,
      [ids, ids]
    );

    res.json({ dispositivos, medicoes, alertas, stats: stats[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao buscar dados' });
  }
});

// RECEBER DADOS DO ESP32
app.post('/api/medicao', async (req, res) => {
  try {
    const { token, db_valor } = req.body;
    const [disp] = await db.query(
      'SELECT * FROM dispositivos WHERE token = ? AND ativo = 1',
      [token]
    );
    if (disp.length === 0) return res.status(401).json({ erro: 'Dispositivo não encontrado' });

    const dispositivo = disp[0];
    await db.query(
      'INSERT INTO medicoes (dispositivo_id, db_valor) VALUES (?, ?)',
      [dispositivo.id, db_valor]
    );

    let tipo = null;
    let mensagem = null;
    if (db_valor >= 80) { tipo = 'alto'; mensagem = `Ruído crítico de ${db_valor} dB detectado`; }
    else if (db_valor >= 65) { tipo = 'moderado'; mensagem = `Ruído elevado de ${db_valor} dB detectado`; }

    if (tipo) {
      await db.query(
        'INSERT INTO alertas (dispositivo_id, tipo, db_valor, mensagem) VALUES (?, ?, ?, ?)',
        [dispositivo.id, tipo, db_valor, mensagem]
      );
    }

    res.json({ sucesso: true });
  } catch (e) {
    res.status(500).json({ erro: 'Erro ao salvar medição' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ECHON API rodando na porta ${PORT}`));
