#pragma once
#include <math.h>
#include <stdint.h>

// Parámetros experimentales de procesamiento, no calibraciones geotécnicas.
struct Orientacion {
  static constexpr unsigned MUESTRAS_BASELINE = 75;
  static constexpr unsigned VENTANA = 10;
  static constexpr uint32_t ESTABILIZACION_MS = 3000;
  static constexpr uint32_t EVALUACION_MS = 10000;
  static constexpr unsigned PERSISTENCIA = 6;
  float roll = 0, pitch = 0, baselineRoll = 0, baselinePitch = 0;
  float deltaRoll = 0, deltaPitch = 0;
  bool calibrada = false, valida = false;
  unsigned muestras = 0, contadores[3] = {0, 0, 0};
  unsigned estado = 0; // NORMAL, PRECAUCION, ALERTA, CRITICO: solo inclinación.
  double sumaBase[3] = {0, 0, 0};
  float ventana[VENTANA][3] = {};
  unsigned posicion = 0, cantidad = 0;
  uint32_t inicio = 0, ultimaEvaluacion = 0;

  void iniciar(uint32_t ahora) { inicio = ahora; }
  static float diferencia(float actual, float base) {
    float d = fmodf(actual - base + 180.0f, 360.0f);
    if (d < 0) d += 360.0f;
    return d - 180.0f;
  }
  static void angulos(float x, float y, float z, float& r, float& p) {
    const float grados = 180.0f / 3.14159265358979323846f;
    r = atan2f(y, z) * grados;
    p = atan2f(-x, hypotf(y, z)) * grados;
  }
  void invalidar(uint32_t ahora) {
    valida = false;
    cantidad = posicion = 0;
    for (unsigned i = 0; i < 3; ++i) contadores[i] = 0;
    estado = 0;
    ultimaEvaluacion = ahora;
    if (!calibrada) {
      muestras = 0;
      for (unsigned i = 0; i < 3; ++i) sumaBase[i] = 0;
    }
  }
  void actualizar(float x, float y, float z, bool lecturaCorrecta, uint32_t ahora) {
    if (!lecturaCorrecta || !isfinite(x) || !isfinite(y) || !isfinite(z) ||
        (x == 0 && y == 0 && z == 0)) { invalidar(ahora); return; }
    if (ahora - inicio < ESTABILIZACION_MS) return;
    if (!calibrada) {
      sumaBase[0] += x; sumaBase[1] += y; sumaBase[2] += z;
      if (++muestras < MUESTRAS_BASELINE) return;
      const float bx = sumaBase[0] / muestras, by = sumaBase[1] / muestras;
      const float bz = sumaBase[2] / muestras;
      if (bx == 0 && by == 0 && bz == 0) { invalidar(ahora); return; }
      angulos(bx, by, bz, baselineRoll, baselinePitch);
      calibrada = true;
      ultimaEvaluacion = ahora;
    }
    ventana[posicion][0] = x; ventana[posicion][1] = y; ventana[posicion][2] = z;
    posicion = (posicion + 1) % VENTANA;
    if (cantidad < VENTANA) ++cantidad;
    float media[3] = {};
    for (unsigned i = 0; i < cantidad; ++i)
      for (unsigned j = 0; j < 3; ++j) media[j] += ventana[i][j] / cantidad;
    if (media[0] == 0 && media[1] == 0 && media[2] == 0) { invalidar(ahora); return; }
    angulos(media[0], media[1], media[2], roll, pitch);
    deltaRoll = diferencia(roll, baselineRoll);
    deltaPitch = diferencia(pitch, baselinePitch);
    valida = true;
    const float cambio = fmaxf(fabsf(deltaRoll), fabsf(deltaPitch));
    const float umbrales[3] = {0.5f, 1.0f, 2.0f};
    // Un retorno observado entre evaluaciones también interrumpe persistencia.
    estado = 0;
    for (unsigned i = 0; i < 3; ++i) {
      if (cambio < umbrales[i]) contadores[i] = 0;
      if (contadores[i] >= PERSISTENCIA) estado = i + 1;
    }
    if (ahora - ultimaEvaluacion < EVALUACION_MS) return;
    // No recuperar ciclos perdidos contando varias veces una misma lectura.
    ultimaEvaluacion = ahora;
    estado = 0;
    for (unsigned i = 0; i < 3; ++i) {
      contadores[i] = cambio >= umbrales[i] ?
        (contadores[i] < PERSISTENCIA ? contadores[i] + 1 : PERSISTENCIA) : 0;
      if (contadores[i] >= PERSISTENCIA) estado = i + 1;
    }
  }
  const char* nombreEstado() const {
    if (!calibrada) return "CALIBRANDO";
    if (!valida) return "SIN_DATO_VALIDO";
    const char* nombres[] = {"NORMAL", "PRECAUCION", "ALERTA", "CRITICO"};
    return nombres[estado];
  }
};
