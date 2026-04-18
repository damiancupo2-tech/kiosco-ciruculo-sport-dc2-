# Guía de Uso: Planilla Diaria de Caja

## Nueva Funcionalidad

Se ha agregado un botón **"Planilla"** a la sección de Movimientos de Caja que permite generar un resumen diario automático.

## Dónde Está

En la barra de botones superior derecha de la sección "Movimientos de Caja", junto a los botones "Exportar" y "Nuevo Movimiento".

## Qué Hace

Al presionar el botón **"Planilla"**, se abre una ventana modal que muestra:

### Columnas del Resumen
- **Fecha**: Día del resumen
- **Ing. Efvo**: Ingresos en efectivo del día
- **Ing. Transfer**: Ingresos por transferencia del día
- **Ing. QR**: Ingresos por QR del día
- **Egr. Efvo**: Egresos en efectivo del día
- **Egr. Transfer**: Egresos por transferencia del día
- **Egr. QR**: Egresos por QR del día
- **Total Diario**: Balance neto del día (ingresos - egresos)

### Fila de Totales
Al final se muestra automáticamente la suma de todas las columnas para el período filtrado.

## Características de Interacción

### 1. Copiar Línea
- Cada fila tiene un botón **copy** (icono de portapapeles)
- Al hacer click, copia el contenido de esa fila al portapapeles
- Muestra un check verde durante 2 segundos

### 2. Compartir Planilla
- Botón **"Compartir"** (icono de compartir)
- Si tu navegador lo soporta, abre el selector de aplicaciones nativas para compartir
- Si no, copia toda la planilla al portapapeles
- Incluye un resumen formateado con todas las columnas

### 3. Descargar CSV
- Botón **"Descargar CSV"**
- Descarga el resumen en formato CSV compatible con Excel
- Nombre: `planilla_diaria_YYYY-MM-DD.csv`
- Incluye la fila de totales

## Rango de Fechas

La planilla se genera según el período seleccionado en el filtro:
- **Hoy**: Solo el día actual
- **Esta Semana**: Todos los días de la semana en curso
- **Este Mes**: Todos los días del mes actual
- **Todo**: Todos los registros del sistema
- **Personalizado**: Según las fechas que especifiques

## Ejemplo de Uso

1. En la sección "Caja", selecciona el período deseado (ej: "Este Mes")
2. Presiona el botón azul **"Planilla"**
3. Se abre la ventana con el resumen diario
4. Puedes:
   - Copiar líneas individuales (botones copy en cada fila)
   - Compartir el resumen completo (botón Compartir)
   - Descargar como CSV (botón Descargar CSV)

## Notas Importantes

- La planilla se genera automáticamente agrupando TODOS los movimientos del período filtrado
- Si no hay movimientos para una fecha, esa fecha no aparece en la planilla
- El color del "Total Diario" es azul para valores positivos y rojo para negativos
- Los totales se calculan automáticamente según los movimientos registrados
- La planilla se puede generar cuantas veces quieras sin afectar los datos
