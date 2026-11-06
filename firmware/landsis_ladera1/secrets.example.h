#pragma once

// Copiar como secrets.h y configurar localmente. No versionar secrets.h.
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* API_URL = "https://YOUR_DOMAIN/api/v1/readings";
// Mismo token privado configurado en backend; no usar este ejemplo como secreto.
const char* IOT_DEVICE_TOKEN = "";
// PEM de la CA raíz verificada que firma la cadena del servidor. No certificado leaf.
const char* API_ROOT_CA = R"PEM()PEM";
// Servidor NTP accesible desde la red del nodo; confirmar al instalar.
const char* NTP_SERVER = "pool.ntp.org";
