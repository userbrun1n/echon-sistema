-- 1. TABELA DE CLIENTES (contratantes)
CREATE TABLE clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    logo_url VARCHAR(255),
    cor_primaria VARCHAR(7) DEFAULT '#1E6FD9',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABELA DE DISPOSITIVOS (cada ESP32)
CREATE TABLE dispositivos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    nome VARCHAR(100) NOT NULL,
    local VARCHAR(100) NOT NULL,
    token VARCHAR(64) UNIQUE NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

-- 3. TABELA DE MEDICOES (dados do ESP32)
CREATE TABLE medicoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dispositivo_id INT NOT NULL,
    db_valor DECIMAL(5,2) NOT NULL,
    registrado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id)
);

-- 4. TABELA DE ALERTAS
CREATE TABLE alertas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dispositivo_id INT NOT NULL,
    tipo ENUM('alto','moderado','normalizado') NOT NULL,
    db_valor DECIMAL(5,2) NOT NULL,
    mensagem VARCHAR(255),
    registrado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id)
);

-- 5. INSERIR CLIENTES DE TESTE
INSERT INTO clientes (nome, email, senha, cor_primaria) VALUES
('Cinemark', 'cinemark@echon.app', 'cinemark123', '#E50914'),
('Escola Modelo', 'escola@echon.app', 'escola123', '#1E6FD9');

-- 6. INSERIR DISPOSITIVOS DE TESTE
INSERT INTO dispositivos (cliente_id, nome, local, token) VALUES
(1, 'Sensor Sala 1', 'Cinema 1 - Corredor', 'token-cinemark-abc123'),
(2, 'Sensor Sala A', 'Sala de Aula A', 'token-escola-xyz456');

-- 7. INSERIR MEDICOES SIMULADAS (para testar o dashboard)
INSERT INTO medicoes (dispositivo_id, db_valor) VALUES
(1, 45.2), (1, 52.1), (1, 61.3), (1, 78.9), (1, 55.0),
(1, 48.3), (1, 63.7), (1, 71.2), (1, 58.4), (1, 49.1),
(2, 38.1), (2, 42.5), (2, 55.8), (2, 61.2), (2, 47.3),
(2, 39.8), (2, 44.1), (2, 58.9), (2, 52.3), (2, 41.7);
