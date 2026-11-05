#pragma once

#include <WiFi.h>
#include <HTTPClient.h>
#include <math.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/queue.h>
#include "secrets.h"

// Parámetros de prueba de comunicación; no son calibraciones de sensores.
const unsigned long INTERVALO_ENVIO_MS = 10000;
const unsigned long INTERVALO_RECONEXION_MS = 10000;
const int32_t HTTP_CONNECT_TIMEOUT_MS = 2000;
const uint16_t HTTP_READ_TIMEOUT_MS = 2000;

struct OrientacionEnvio {
  bool calibrada, valida;
  float roll, pitch, baselineRoll, baselinePitch, deltaRoll, deltaPitch;
  unsigned estado, precautionCount, alertCount, criticalCount;
};

struct LecturaEnvio {
  int humedadRaw;
  bool vibracion;
  float accelX, accelY, accelZ;
  float gyroX, gyroY, gyroZ;
  float temperatura;
  uint32_t generacion;
  OrientacionEnvio orientacion;
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
  bool huboConexion = false;
  unsigned long ultimoIntento = millis();

  for (;;) {
    bool conectado = WiFi.status() == WL_CONNECTED;
    if (conectado && !estabaConectado) {
      Serial.println(huboConexion ? "WiFi: recuperado." : "WiFi: conectado.");
      huboConexion = true;
      ultimoIntento = millis();
    } else if (!conectado && estabaConectado) {
      Serial.println("WiFi: conexión perdida; sensores continúan.");
    }
    estabaConectado = conectado;
    if (!conectado && millis() - ultimoIntento >= INTERVALO_RECONEXION_MS) {
      ultimoIntento = millis();
      Serial.println("WiFi: intentando reconexión.");
      if (!WiFi.reconnect()) {
        // Puede haber un intento automático en curso; no forzar begin/disconnect.
        Serial.printf("WiFi: core no aceptó reconexión; estado %d. Se espera otro ciclo.\n",
                      static_cast<int>(WiFi.status()));
      }
    }

    LecturaEnvio lectura;
    if (xQueueReceive(colaLecturas, &lectura, pdMS_TO_TICKS(100)) != pdTRUE) {
      continue;
    }
    ResultadoEnvio resultado = {false, lectura.generacion};
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("HTTP omitido: WiFi no disponible; se conserva vibración.");
    } else {
      char orientacionJson[512];
      const auto& o = lectura.orientacion;
      const char* estados[] = {"NORMAL", "PRECAUCION", "ALERTA", "CRITICO"};
      int longitudOrientacion;
      if (!o.calibrada || !o.valida) {
        longitudOrientacion = snprintf(orientacionJson, sizeof(orientacionJson),
          "{\"status\":\"%s\"}", o.calibrada ? "unavailable" : "calibrating");
      } else {
        longitudOrientacion = snprintf(orientacionJson, sizeof(orientacionJson),
          "{\"status\":\"ready\",\"roll\":%.6f,\"pitch\":%.6f,"
          "\"baselineRoll\":%.6f,\"baselinePitch\":%.6f,\"deltaRoll\":%.6f,\"deltaPitch\":%.6f,"
          "\"inclinationState\":\"%s\",\"precautionCount\":%u,\"alertCount\":%u,\"criticalCount\":%u}",
          o.roll, o.pitch, o.baselineRoll, o.baselinePitch, o.deltaRoll, o.deltaPitch,
          estados[o.estado], o.precautionCount, o.alertCount, o.criticalCount);
      }
      char json[1024];
      int longitud = snprintf(json, sizeof(json),
        "{\"nodeId\":\"LADERA-1\",\"soilMoistureRaw\":%d,"
        "\"vibrationDetected\":%s,\"accelX\":%.6f,\"accelY\":%.6f,"
        "\"accelZ\":%.6f,\"gyroX\":%.6f,\"gyroY\":%.6f,"
        "\"gyroZ\":%.6f,\"temperature\":%.6f,\"orientation\":%s}",
        lectura.humedadRaw, lectura.vibracion ? "true" : "false",
        lectura.accelX, lectura.accelY, lectura.accelZ,
        lectura.gyroX, lectura.gyroY, lectura.gyroZ, lectura.temperatura, orientacionJson);
      if (longitudOrientacion <= 0 || static_cast<size_t>(longitudOrientacion) >= sizeof(orientacionJson) ||
          longitud <= 0 || static_cast<size_t>(longitud) >= sizeof(json)) {
        Serial.println("HTTP omitido: JSON excede el buffer.");
      } else {
        WiFiClient cliente;
        HTTPClient http;
        http.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
        http.setTimeout(HTTP_READ_TIMEOUT_MS);
        http.setReuse(false);
        if (!http.begin(cliente, API_URL)) {
          Serial.println("HTTP: no se pudo iniciar; revisar URL local.");
        } else {
          http.addHeader("Content-Type", "application/json");
          Serial.println("HTTP: enviando medición multisensor.");
          unsigned long inicioSolicitud = millis();
          int codigo = http.POST(reinterpret_cast<uint8_t*>(json), longitud);
          resultado.aceptado = codigo == 201;
          if (codigo < 0) {
            String detalle = HTTPClient::errorToString(codigo);
            Serial.printf("HTTP transporte: %d (%s); duración %lu ms; WiFi estado %d.\n",
                          codigo, detalle.c_str(), millis() - inicioSolicitud,
                          static_cast<int>(WiFi.status()));
          } else if (resultado.aceptado) {
            Serial.printf("HTTP: 201 accepted; duración %lu ms.\n", millis() - inicioSolicitud);
          } else {
            Serial.printf("HTTP servidor: %d; duración %lu ms.\n", codigo, millis() - inicioSolicitud);
          }
          if (!resultado.aceptado) {
            Serial.println("HTTP: sin confirmación; vibración conservada, próxima lectura en otro ciclo.");
          }
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
