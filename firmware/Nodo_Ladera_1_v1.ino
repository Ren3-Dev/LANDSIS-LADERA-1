#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

// =====================================================
// LANDSIS LADERA-1
// Prueba integrada del Nodo Ladera
// =====================================================

// -----------------------------
// Pines
// -----------------------------

#define PIN_HUMEDAD     34
#define PIN_VIBRACION   27

#define PIN_SDA         21
#define PIN_SCL         22

// -----------------------------
// MPU6050
// -----------------------------

Adafruit_MPU6050 mpu;

bool mpuDisponible = false;
uint8_t direccionMPU = 0;

// -----------------------------
// Vibración
// -----------------------------

bool vibracionDetectada = false;

// -----------------------------
// Temporización
// -----------------------------

unsigned long ultimoReporte = 0;

const unsigned long INTERVALO_REPORTE = 1000;


// =====================================================
// Lectura promedio de humedad
// =====================================================

int leerHumedadPromedio() {

  const int muestras = 10;

  long suma = 0;

  for (int i = 0; i < muestras; i++) {

    suma += analogRead(PIN_HUMEDAD);

    delay(2);
  }

  return suma / muestras;
}


// =====================================================
// Buscar MPU6050
// =====================================================

bool iniciarMPU() {

  Serial.println("Buscando MPU6050...");

  // Primero probar dirección habitual
  if (mpu.begin(0x68, &Wire)) {

    direccionMPU = 0x68;

    Serial.println("MPU6050 encontrado en 0x68");

    return true;
  }

  // Después probar dirección alternativa
  if (mpu.begin(0x69, &Wire)) {

    direccionMPU = 0x69;

    Serial.println("MPU6050 encontrado en 0x69");

    return true;
  }

  Serial.println("ERROR: MPU6050 no encontrado.");

  return false;
}


// =====================================================
// SETUP
// =====================================================

void setup() {

  Serial.begin(115200);

  delay(1500);

  Serial.println();
  Serial.println("=======================================");
  Serial.println("LANDSIS LADERA-1");
  Serial.println("Nodo Ladera - Prueba integrada");
  Serial.println("=======================================");

  // -----------------------------
  // Sensores
  // -----------------------------

  pinMode(PIN_HUMEDAD, INPUT);

  pinMode(PIN_VIBRACION, INPUT);

  // -----------------------------
  // I2C
  // -----------------------------

  Wire.begin(PIN_SDA, PIN_SCL);

  Wire.setClock(100000);

  // -----------------------------
  // MPU6050
  // -----------------------------

  mpuDisponible = iniciarMPU();

  if (mpuDisponible) {

    mpu.setAccelerometerRange(
      MPU6050_RANGE_8_G
    );

    mpu.setGyroRange(
      MPU6050_RANGE_500_DEG
    );

    mpu.setFilterBandwidth(
      MPU6050_BAND_21_HZ
    );

    Serial.println("MPU6050 configurado correctamente.");
  }

  Serial.println();
  Serial.println("Nodo iniciado.");
  Serial.println("Esperando datos...");
  Serial.println();
}


// =====================================================
// LOOP
// =====================================================

void loop() {

  // ===================================================
  // VIBRACIÓN
  //
  // Se lee continuamente porque el 801S puede generar
  // pulsos muy cortos.
  // ===================================================

  int estadoVibracion = digitalRead(PIN_VIBRACION);

  if (estadoVibracion == HIGH) {

    vibracionDetectada = true;
  }


  // ===================================================
  // REPORTE CADA 1 SEGUNDO
  // ===================================================

  if (millis() - ultimoReporte >= INTERVALO_REPORTE) {

    ultimoReporte = millis();


    // -----------------------------------------------
    // Humedad
    // -----------------------------------------------

    int humedadRaw =
      leerHumedadPromedio();


    // -----------------------------------------------
    // MPU6050
    // -----------------------------------------------

    float accelX = 0;
    float accelY = 0;
    float accelZ = 0;

    float gyroX = 0;
    float gyroY = 0;
    float gyroZ = 0;

    float temperatura = 0;


    if (mpuDisponible) {

      sensors_event_t aceleracion;
      sensors_event_t giroscopio;
      sensors_event_t temp;

      mpu.getEvent(
        &aceleracion,
        &giroscopio,
        &temp
      );

      accelX = aceleracion.acceleration.x;
      accelY = aceleracion.acceleration.y;
      accelZ = aceleracion.acceleration.z;

      gyroX = giroscopio.gyro.x;
      gyroY = giroscopio.gyro.y;
      gyroZ = giroscopio.gyro.z;

      temperatura = temp.temperature;
    }


    // =================================================
    // Mostrar resultado
    // =================================================

    Serial.println("---------------------------------------");

    Serial.print("Humedad RAW: ");
    Serial.println(humedadRaw);


    Serial.print("Vibracion: ");

    if (vibracionDetectada) {

      Serial.println("DETECTADA");

    } else {

      Serial.println("NO DETECTADA");
    }


    if (mpuDisponible) {

      Serial.println();

      Serial.println("ACELEROMETRO (m/s^2)");

      Serial.print("X: ");
      Serial.print(accelX, 3);

      Serial.print(" | Y: ");
      Serial.print(accelY, 3);

      Serial.print(" | Z: ");
      Serial.println(accelZ, 3);


      Serial.println("GIROSCOPIO (rad/s)");

      Serial.print("X: ");
      Serial.print(gyroX, 3);

      Serial.print(" | Y: ");
      Serial.print(gyroY, 3);

      Serial.print(" | Z: ");
      Serial.println(gyroZ, 3);


      Serial.print("Temperatura MPU: ");

      Serial.print(temperatura, 2);

      Serial.println(" C");
    }


    // =================================================
    // Salida estructurada
    // =================================================

    Serial.println();

    Serial.print("{");

    Serial.print("\"soil_moisture_raw\":");
    Serial.print(humedadRaw);

    Serial.print(",");

    Serial.print("\"vibration_detected\":");
    Serial.print(
      vibracionDetectada
        ? "true"
        : "false"
    );

    if (mpuDisponible) {

      Serial.print(",");

      Serial.print("\"accel_x\":");
      Serial.print(accelX, 3);

      Serial.print(",");

      Serial.print("\"accel_y\":");
      Serial.print(accelY, 3);

      Serial.print(",");

      Serial.print("\"accel_z\":");
      Serial.print(accelZ, 3);

      Serial.print(",");

      Serial.print("\"gyro_x\":");
      Serial.print(gyroX, 3);

      Serial.print(",");

      Serial.print("\"gyro_y\":");
      Serial.print(gyroY, 3);

      Serial.print(",");

      Serial.print("\"gyro_z\":");
      Serial.print(gyroZ, 3);

      Serial.print(",");

      Serial.print("\"temperature\":");
      Serial.print(temperatura, 2);
    }

    Serial.println("}");


    // -----------------------------------------------
    // Reiniciar evento de vibración
    // -----------------------------------------------

    vibracionDetectada = false;
  }

  // Muy pequeño para poder capturar pulsos del 801S
  delay(2);
}