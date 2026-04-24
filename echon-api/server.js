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
        cor_primaria: cliente.cor_primaria,
        logo_url: cliente.logo_url
      }
    });
  } catch (e) {
    res.status(500).json({ erro: 'Erro no servidor' });
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
