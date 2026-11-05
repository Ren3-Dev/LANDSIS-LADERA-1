# Humedad relativa del sensor

Referencias confirmadas por el usuario el 5 de noviembre de 2026 a partir de pruebas: 4095 RAW en aire/seco (0 %) y 0 RAW estable con la parte sensible en agua (100 %).

Conversión lineal: porcentaje = (4095 - RAW) / 4095 × 100. La pantalla redondea a enteros. Es una escala relativa experimental del sensor, no una medición del contenido volumétrico del agua en suelo ni una calibración metrológica definitiva.

Dashboard, gráfica e historiales muestran porcentaje. El dashboard y las tablas conservan el RAW visible; la gráfica lo incluye en el detalle de cada punto. Sin lectura no se muestra un porcentaje ficticio. Firmware, API, PostgreSQL y criterios del semáforo no cambian; el dato original se conserva.
