# 🔄 Guía de Restauración de Versiones

## Punto de Restauración Estable

**Tag:** `v1.0-stable-web-speech-api`
**Commit:** `9cf2b5f`
**Fecha:** 2025-10-05

### ✅ Sistema en este punto:
- Web Speech API funcionando
- Audio activable manualmente en móviles
- Selección inteligente de voces en español
- Interfaz responsive para iPhone
- WebRTC streaming completo
- Métricas médicas estabilizadas

---

## 📋 Cómo Restaurar a Esta Versión

### Opción 1: Ver el código sin cambiar nada (seguro)
```bash
git checkout v1.0-stable-web-speech-api
# Explorar el código
# Para volver a la versión actual:
git checkout main
```

### Opción 2: Crear branch desde este punto (recomendado)
```bash
# Crear nuevo branch desde el tag
git checkout -b hotfix-from-stable v1.0-stable-web-speech-api

# Trabajar en este branch
# Hacer cambios, commits, etc.

# Si quieres merge a main:
git checkout main
git merge hotfix-from-stable
```

### Opción 3: Revertir main a esta versión (CUIDADO)
```bash
# ⚠️ ESTO ELIMINA COMMITS POSTERIORES
git checkout main
git reset --hard v1.0-stable-web-speech-api
git push --force origin main  # Requiere permisos
```

---

## 🔍 Ver Diferencias con Versión Actual

```bash
# Ver qué cambió desde el tag
git diff v1.0-stable-web-speech-api..main

# Ver commits desde el tag
git log v1.0-stable-web-speech-api..main --oneline
```

---

## 📦 Deployment en DigitalOcean

### Restaurar en servidor de producción:
```bash
# SSH al servidor
cd /ruta/tu/proyecto

# Ver tags disponibles
git fetch --tags
git tag -l

# Cambiar a versión estable
git checkout v1.0-stable-web-speech-api

# Reiniciar servicio
pm2 restart telemedicina
# o
npm restart
```

### Volver a última versión:
```bash
git checkout main
git pull origin main
pm2 restart telemedicina
```

---

## 🏷️ Tags Disponibles

Para ver todos los tags:
```bash
git tag -l -n9
```

Para crear un nuevo punto de restauración:
```bash
git tag -a v1.1-descripcion -m "Descripción del punto estable"
git push origin v1.1-descripcion
```

---

## 🆘 Ayuda Rápida

**Si algo falla después de cambios:**
1. `git checkout v1.0-stable-web-speech-api`
2. Verificar que funciona
3. Crear branch nuevo desde aquí
4. Re-implementar cambios con cuidado

**Si quieres comparar archivos específicos:**
```bash
git diff v1.0-stable-web-speech-api:paciente.html main:paciente.html
```

**Si perdiste el tag (muy raro):**
El commit `9cf2b5f` siempre estará disponible:
```bash
git checkout 9cf2b5f
```
