// ============================================================
//  SONARA - Echon | Código de Teste v1.3
//  Hardware: ESP32 + MAX9814 (GAIN=GND) + LCD I2C + LEDs RGB
//  + WiFi + Envio para API ECHON
// ============================================================

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// --- LCD ---
LiquidCrystal_I2C lcd(0x27, 16, 2);

// --- Pinos ---
#define MIC_PIN      34
#define LED_VERDE    2
#define LED_AMARELO  4
#define LED_VERMELHO 5

// --- ADC ---
#define AMOSTRAS      512
#define ADC_REF_MV    3300
#define ADC_RESOLUCAO 4095
#define OFFSET_ADC    1350
#define DB_OFFSET     8.0

// --- Thresholds padrão (serão substituídos pela API) ---
float LIMITE_VERDE   = 68.0;
float LIMITE_AMARELO = 80.0;

// --- Janela de tempo ---
#define JANELA_MS  10000UL

// --- WiFi ---
const char* WIFI_SSID    = "A55";
const char* WIFI_SENHA   = "07101114";

// --- API ---
const char* API_URL      = "https://echon-api.onrender.com";
const char* SENSOR_TOKEN = "echon-rot6stt02u25";

// --- Protótipos ---
void todosLedsOff();
void atualizarLEDs(float db);
void atualizarLCD(float db, bool primeiraLeitura);
float lerNivelDB();
float corrigirDB(float db);
void conectarWiFi();
void buscarParametros();
void enviarMedicao(float db);

// --- Variáveis globais ---
float mediaAtual       = 0.0;
bool  primeiraLeitura  = true;
unsigned long inicioJanela = 0;
float somaJanela       = 0.0;
long  contadorJanela   = 0;

// ============================================================
void setup() {
  Serial.begin(115200);

  pinMode(LED_VERDE,    OUTPUT);
  pinMode(LED_AMARELO,  OUTPUT);
  pinMode(LED_VERMELHO, OUTPUT);
  todosLedsOff();

  Wire.begin();
  delay(100);
  lcd.init();
  lcd.init();
  lcd.backlight();
  lcd.clear();
  delay(100);
  lcd.setCursor(0, 0);
  lcd.print("  Sonara v1.3   ");
  lcd.setCursor(0, 1);
  lcd.print("  Inicializando ");
  delay(2000);
  lcd.clear();

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // Conecta WiFi
  conectarWiFi();

  // Busca parâmetros do ambiente na API
  buscarParametros();

  inicioJanela   = millis();''
  somaJanela     = 0.0;
  contadorJanela = 0;

  lcd.setCursor(0, 0);
  lcd.print("Primeira leitura");
  lcd.setCursor(0, 1);
  lcd.print("em andamento... ");

  Serial.println("=== SONARA - Monitor de Ruido ===");
  Serial.println("Aguardando primeira janela...");
}

// ============================================================
void loop() {
  float db = lerNivelDB();
  db = corrigirDB(db);
  somaJanela += db;
  contadorJanela++;

  if (millis() - inicioJanela >= JANELA_MS) {
    mediaAtual = somaJanela / contadorJanela;

    Serial.print("=== Janela fechada | Media: ");
    Serial.print(mediaAtual, 1);
    Serial.println(" dB ===");

    atualizarLEDs(mediaAtual);
    primeiraLeitura = false;

    // Envia para a API
    enviarMedicao(mediaAtual);

    somaJanela     = 0.0;
    contadorJanela = 0;
    inicioJanela   = millis();
  }

  atualizarLCD(mediaAtual, primeiraLeitura);
  delay(300);
}

// ============================================================
void conectarWiFi() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Conectando WiFi ");
  lcd.setCursor(0, 1);
  lcd.print(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_SENHA);
  Serial.print("Conectando ao WiFi");

  int tentativas = 0;
  while (WiFi.status() != WL_CONNECTED && tentativas < 20) {
    delay(500);
    Serial.print(".");
    tentativas++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi conectado! IP: " + WiFi.localIP().toString());
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi conectado! ");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
    delay(2000);
  } else {
    Serial.println("\nFalha no WiFi. Modo offline.");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Sem WiFi - OK   ");
    lcd.setCursor(0, 1);
    lcd.print("Modo offline    ");
    delay(2000);
  }
}

// ============================================================
void buscarParametros() {
  if (WiFi.status() != WL_CONNECTED) return;

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Buscando config ");
  lcd.setCursor(0, 1);
  lcd.print("do ambiente...  ");

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url = String(API_URL) + "/api/parametros/" + SENSOR_TOKEN;
  http.begin(client, url);
  http.setTimeout(30000);

  int httpCode = http.GET();
  Serial.println("buscarParametros HTTP: " + String(httpCode));

  if (httpCode == 200) {
    String payload = http.getString();
    Serial.println("Parametros: " + payload);

    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      LIMITE_VERDE   = doc["verde"]   | 68.0;
      LIMITE_AMARELO = doc["amarelo"] | 80.0;

      Serial.println("Limite verde: "   + String(LIMITE_VERDE));
      Serial.println("Limite amarelo: " + String(LIMITE_AMARELO));
      Serial.println("Ambiente: "       + doc["ambiente"].as<String>());

      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Config recebida!");
      lcd.setCursor(0, 1);
      String amb = doc["ambiente"].as<String>();
      if (amb.length() > 16) amb = amb.substring(0, 16);
      lcd.print(amb);
      delay(2000);
    }
  } else {
    Serial.println("Usando config padrao.");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Config padrao   ");
    lcd.setCursor(0, 1);
    lcd.print("V:" + String(LIMITE_VERDE,0) + " A:" + String(LIMITE_AMARELO,0));
    delay(2000);
  }

  http.end();
}

// ============================================================
void enviarMedicao(float db) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Sem WiFi - medicao nao enviada");
    return;
  }

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url = String(API_URL) + "/api/medicao";
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(30000);

  String body = "{\"token\":\"" + String(SENSOR_TOKEN) + "\",\"db_valor\":" + String(db, 2) + "}";
  Serial.println("Enviando: " + body);

  int httpCode = http.POST(body);

  if (httpCode == 200) {
    Serial.println("Medicao enviada!");
  } else {
    Serial.println("Erro ao enviar: " + String(httpCode));
  }

  http.end();
}

// ============================================================
float corrigirDB(float db) {
  if (db <= 42.0) {
    float fator = (db - 30.0) / (42.0 - 30.0);
    fator = max(fator, 0.0f);
    return db - (fator * 9.0);
  } else if (db <= 50.0) {
    float fator = (db - 42.0) / (50.0 - 42.0);
    return db + (fator * 20.0);
  } else if (db <= 74.0) {
    float fator = (db - 50.0) / (74.0 - 50.0);
    return db + 20.0 + (fator * 11.0);
  } else {
    return db + 14.0;
  }
}

// ============================================================
float lerNivelDB() {
  long somaQuadrados = 0;

  for (int i = 0; i < AMOSTRAS; i++) {
    int amostra  = analogRead(MIC_PIN);
    int centrado = amostra - OFFSET_ADC;
    somaQuadrados += (long)centrado * centrado;
  }

  float rms = sqrt((float)somaQuadrados / AMOSTRAS);
  float tensaoRMS_mV = (rms / ADC_RESOLUCAO) * ADC_REF_MV;

  float db = 0.0;
  if (tensaoRMS_mV > 0.1) {
    db = 20.0 * log10(tensaoRMS_mV) + DB_OFFSET;
  }

  if (db < 30.0) db = 30.0;
  if (db > 100.0) db = 100.0;

  return db;
}

// ============================================================
void atualizarLCD(float db, bool primeira) {
  if (primeira) return;

  lcd.setCursor(0, 0);
  lcd.print("Media de Ruido: ");

  lcd.setCursor(0, 1);
  lcd.print("                ");
  lcd.setCursor(0, 1);
  lcd.print(db, 1);
  lcd.print(" dB  ");

  lcd.setCursor(9, 1);
  if (db < LIMITE_VERDE) {
    lcd.print("[OK]   ");
  } else if (db < LIMITE_AMARELO) {
    lcd.print("[MEDIO]");
  } else {
    lcd.print("[ALTO] ");
  }
}

// ============================================================
void atualizarLEDs(float db) {
  todosLedsOff();

  if (db < LIMITE_VERDE) {
    digitalWrite(LED_VERDE, HIGH);
  } else if (db < LIMITE_AMARELO) {
    digitalWrite(LED_AMARELO, HIGH);
  } else {
    digitalWrite(LED_VERMELHO, HIGH);
  }
}

// ============================================================
void todosLedsOff() {
  digitalWrite(LED_VERDE,    LOW);
  digitalWrite(LED_AMARELO,  LOW);
  digitalWrite(LED_VERMELHO, LOW);
}