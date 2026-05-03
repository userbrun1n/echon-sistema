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
    // Busca thresholds do ambiente do cliente
    let limites = { verde: 55, amarelo: 70, vermelho: 70, ambiente: 'Padrão' };
    if (cliente.ambiente_id) {
      const [amb] = await db.query('SELECT * FROM ambientes WHERE id = ?', [cliente.ambiente_id]);
      if (amb.length > 0) {
        limites = {
          verde: parseFloat(cliente.limite_verde || amb[0].limite_verde),
          amarelo: parseFloat(cliente.limite_amarelo || amb[0].limite_amarelo),
          vermelho: parseFloat(cliente.limite_vermelho || amb[0].limite_vermelho),
          ambiente: amb[0].nome
        };
      }
    }
    res.json({
      token,
      cliente: {
        id: cliente.id,
        nome: cliente.nome,
        email: cliente.email,
        cor_primaria: cliente.cor_primaria,
        logo_url: cliente.logo_url,
        limites
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

    // Insere cliente com ambiente
    const ambienteId = req.body.ambienteId || 3;
    const limiteVerde = req.body.limiteVerde || null;
    const limiteAmarelo = req.body.limiteAmarelo || null;
    const limiteVermelho = req.body.limiteVermelho || null;

    const [resultado] = await db.query(
      'INSERT INTO clientes (nome, email, senha, ambiente_id, limite_verde, limite_amarelo, limite_vermelho) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nome, email, senha, ambienteId, limiteVerde, limiteAmarelo, limiteVermelho]
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


// LISTAR AMBIENTES (para dropdown no admin)
app.get('/api/ambientes', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM ambientes ORDER BY id');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ erro: 'Erro ao buscar ambientes' });
  }
});

// PARAMETROS PARA ESP32
app.get('/api/parametros/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const [disp] = await db.query(
      `SELECT d.*, c.ambiente_id, c.limite_verde, c.limite_amarelo, c.limite_vermelho,
              a.nome as ambiente_nome, a.limite_verde as amb_verde,
              a.limite_amarelo as amb_amarelo, a.limite_vermelho as amb_vermelho
       FROM dispositivos d
       JOIN clientes c ON c.id = d.cliente_id
       LEFT JOIN ambientes a ON a.id = c.ambiente_id
       WHERE d.token = ? AND d.ativo = 1`,
      [token]
    );
    if (disp.length === 0) return res.status(404).json({ erro: 'Dispositivo não encontrado' });
    const d = disp[0];
    res.json({
      dispositivo: d.nome,
      local: d.local,
      ambiente: d.ambiente_nome || 'Padrão',
      verde: parseFloat(d.limite_verde || d.amb_verde || 55),
      amarelo: parseFloat(d.limite_amarelo || d.amb_amarelo || 70),
      vermelho: parseFloat(d.limite_vermelho || d.amb_vermelho || 80)
    });
  } catch (e) {
    res.status(500).json({ erro: 'Erro ao buscar parâmetros' });
  }
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
      `SELECT a.*, d.nome as dispositivo_nome
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

    // Busca ambiente do cliente
    const [clienteAmb] = await db.query(
      `SELECT c.limite_verde, c.limite_amarelo, c.limite_vermelho,
              a.nome as ambiente_nome, a.limite_verde as amb_verde,
              a.limite_amarelo as amb_amarelo, a.limite_vermelho as amb_vermelho
       FROM clientes c LEFT JOIN ambientes a ON a.id = c.ambiente_id
       WHERE c.id = ?`, [clienteId]
    );
    const ca = clienteAmb[0] || {};
    const limites = {
      verde: parseFloat(ca.limite_verde || ca.amb_verde || 55),
      amarelo: parseFloat(ca.limite_amarelo || ca.amb_amarelo || 70),
      vermelho: parseFloat(ca.limite_vermelho || ca.amb_vermelho || 80),
      ambiente: ca.ambiente_nome || 'Padrão'
    };

    res.json({ dispositivos, medicoes, alertas, stats: stats[0], limites });
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

    // Busca thresholds do cliente dono do dispositivo
    const [clienteInfo] = await db.query(
      `SELECT c.ambiente_id, c.limite_verde, c.limite_amarelo, c.limite_vermelho,
              a.limite_verde as amb_verde, a.limite_amarelo as amb_amarelo, a.limite_vermelho as amb_vermelho
       FROM clientes c
       LEFT JOIN ambientes a ON a.id = c.ambiente_id
       WHERE c.id = ?`,
      [dispositivo.cliente_id]
    );
    const ci = clienteInfo[0] || {};
    const limAmarel = parseFloat(ci.limite_amarelo || ci.amb_amarelo || 65);
    const limVerm = parseFloat(ci.limite_vermelho || ci.amb_vermelho || 80);

    let tipo = null;
    let mensagem = null;
    if (db_valor >= limVerm) { tipo = 'alto'; mensagem = `Ruído crítico de ${db_valor} dB detectado`; }
    else if (db_valor >= limAmarel) { tipo = 'moderado'; mensagem = `Ruído elevado de ${db_valor} dB detectado`; }

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
