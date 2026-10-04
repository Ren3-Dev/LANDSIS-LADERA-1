#pragma once

#include <WiFi.h>
#include <HTTPClient.h>
#include <math.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/queue.h>
#include "secrets.h"

// Parámetros de prueba de comunicación; no son calibraciones de sensores.
const unsigned long INTERVALO_ENVIO_MS = 5000;
const unsigned long INTERVALO_RECONEXION_MS = 10000;
const uint16_t HTTP_TIMEOUT_MS = 2000;

struct LecturaEnvio {
  int humedadRaw;
  bool vibracion;
  float accelX, accelY, accelZ;
  float gyroX, gyroY, gyroZ;
  float temperatura;
  uint32_t generacion;
};

struct ResultadoEnvio {
  bool aceptado;
  uint32_t generacion;
};

QueueHandle_t colaLecturas = nullptr;
QueueHandle_t colaResultados = nullptr;

void tareaComunicacion(void*) {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.println("WiFi: conexión iniciada; sensores continúan.");
  bool estabaConectado = false;
  unsigned long ultimoIntento = millis();

  for (;;) {
    bool conectado = WiFi.status() == WL_CONNECTED;
    if (conectado && !estabaConectado) {
      Serial.println("WiFi: conectado/reconectado.");
    } else if (!conectado && estabaConectado) {
      Serial.println("WiFi: conexión perdida; sensores continúan.");
    }
    estabaConectado = conectado;
    if (!conectado && millis() - ultimoIntento >= INTERVALO_RECONEXION_MS) {
      ultimoIntento = millis();
      Serial.println("WiFi: intentando reconexión.");
      WiFi.reconnect();
    }

    LecturaEnvio lectura;
    if (xQueueReceive(colaLecturas, &lectura, pdMS_TO_TICKS(100)) != pdTRUE) {
      continue;
    }
    ResultadoEnvio resultado = {false, lectura.generacion};
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("HTTP omitido: WiFi no disponible; se conserva vibración.");
    } else {
      char json[768];
      int longitud = snprintf(json, sizeof(json),
        "{\"nodeId\":\"LADERA-1\",\"soilMoistureRaw\":%d,"
        "\"vibrationDetected\":%s,\"accelX\":%.6f,\"accelY\":%.6f,"
        "\"accelZ\":%.6f,\"gyroX\":%.6f,\"gyroY\":%.6f,"
        "\"gyroZ\":%.6f,\"temperature\":%.6f}",
        lectura.humedadRaw, lectura.vibracion ? "true" : "false",
        lectura.accelX, lectura.accelY, lectura.accelZ,
        lectura.gyroX, lectura.gyroY, lectura.gyroZ, lectura.temperatura);
      if (longitud <= 0 || static_cast<size_t>(longitud) >= sizeof(json)) {
        Serial.println("HTTP omitido: JSON excede el buffer.");
      } else {
        WiFiClient cliente;
        HTTPClient http;
        http.setConnectTimeout(HTTP_TIMEOUT_MS);
        http.setTimeout(HTTP_TIMEOUT_MS);
        if (!http.begin(cliente, API_URL)) {
          Serial.println("HTTP: no se pudo iniciar; revisar URL local.");
        } else {
          http.addHeader("Content-Type", "application/json");
          Serial.println("HTTP: enviando medición multisensor.");
          int codigo = http.POST(reinterpret_cast<uint8_t*>(json), longitud);
          Serial.printf("HTTP: código %d\n", codigo);
          resultado.aceptado = codigo == 201;
          Serial.println(resultado.aceptado
            ? "HTTP 201: medición aceptada."
            : "HTTP: fallo; se intentará otra lectura en un ciclo posterior.");
        }
        http.end();
      }
    }
    // Una sola solicitud en curso; el loop consume este resultado sin esperar.
    xQueueOverwrite(colaResultados, &resultado);
  }
}

void iniciarComunicacion() {
  colaLecturas = xQueueCreate(1, sizeof(LecturaEnvio));
  colaResultados = xQueueCreate(1, sizeof(ResultadoEnvio));
  if (!colaLecturas || !colaResultados ||
      xTaskCreate(tareaComunicacion, "landsis-http", 8192, nullptr, 1, nullptr) != pdPASS) {
    if (colaLecturas) vQueueDelete(colaLecturas);
    if (colaResultados) vQueueDelete(colaResultados);
    colaLecturas = nullptr;
    colaResultados = nullptr;
    Serial.println("ERROR: comunicación no iniciada; sensores continúan.");
  }
}
