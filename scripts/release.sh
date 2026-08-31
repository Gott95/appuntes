#!/bin/bash
# Script de release semi-automática para AppUntes
# Uso: ./scripts/release.sh <version_code> <release_notes> [apk_path]
#
# Ejemplo:
#   ./scripts/release.sh 8 "Corrección de bugs y mejoras" ./build-8.apk
#
# Requisitos:
#   - gh CLI instalado y autenticado (https://cli.github.com/)
#   - jq instalado (https://stedolan.github.io/jq/)
#
# Este script:
#   1. Actualiza versionCode en app.json
#   2. Crea un GitHub Release con el APK (si se proporciona la ruta)
#   3. Imprime el comando curl para actualizar Firestore (paso manual)

set -e

VERSION_CODE="$1"
RELEASE_NOTES="$2"
APK_PATH="$3"
APP_JSON="app.json"
REPO="Gott95/appuntes"

if [ -z "$VERSION_CODE" ] || [ -z "$RELEASE_NOTES" ]; then
  echo "Uso: $0 <version_code> <release_notes> [apk_path]"
  echo "Ejemplo: $0 8 'Corrección de bugs' ./build-8.apk"
  exit 1
fi

# 1. Actualizar versionCode en app.json
echo "📝 Actualizando versionCode a $VERSION_CODE en $APP_JSON..."
CURRENT_VERSION=$(jq -r '.expo.version' "$APP_JSON")
VERSION_NAME="1.0.$((VERSION_CODE - 6))"  # Asume que versionCode 7 = v1.0.1, 8 = v1.0.2, etc.

# Usar jq para actualizar el versionCode
jq --argjson vc "$VERSION_CODE" '.expo.android.versionCode = $vc' "$APP_JSON" > "${APP_JSON}.tmp"
mv "${APP_JSON}.tmp" "$APP_JSON"

echo "✅ versionCode actualizado a $VERSION_CODE"
echo "   Versión: $CURRENT_VERSION (versionName estimado: $VERSION_NAME)"
echo ""

# 2. Crear tag y GitHub Release
TAG="v${VERSION_NAME}"
echo "🏷️  Creando tag git: $TAG..."
git tag -a "$TAG" -m "Release $TAG" 2>/dev/null || echo "   Tag $TAG ya existe, continuando..."
git push origin "$TAG" 2>/dev/null || echo "   Tag ya fue pushedeado"

if [ -n "$APK_PATH" ] && [ -f "$APK_PATH" ]; then
  echo "📦 Subiendo APK a GitHub Releases..."
  APK_FILENAME=$(basename "$APK_PATH")
  
  # Crear release con el APK adjunto
  gh release create "$TAG" "$APK_PATH" \
    --repo "$REPO" \
    --title "v$VERSION_NAME" \
    --notes "$RELEASE_NOTES" \
    --latest
  
  DOWNLOAD_URL="https://github.com/$REPO/releases/download/$TAG/$APK_FILENAME"
  echo "✅ Release creado: $DOWNLOAD_URL"
else
  echo "⚠️  No se proporcionó APK o no existe en '$APK_PATH'"
  echo "   Creando release sin APK..."
  gh release create "$TAG" \
    --repo "$REPO" \
    --title "v$VERSION_NAME" \
    --notes "$RELEASE_NOTES" \
    --latest
  
  DOWNLOAD_URL="https://github.com/$REPO/releases/download/$TAG/appuntes.apk"
  echo "   Subí el APK manualmente a: https://github.com/$REPO/releases/edit/$TAG"
fi

echo ""

# 3. Instrucciones para actualizar Firestore
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Paso final: Actualizar Firestore"
echo ""
echo "Ejecutá este curl para actualizar app_config/update:"
echo ""
echo "curl -X PATCH https://firestore.googleapis.com/v1/projects/appuntes-3b7fb/databases/(default)/documents/app_config/update \\"
echo "  -H 'Authorization: Bearer <TU_ACCESS_TOKEN>' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{"
echo "    \"fields\": {"
echo "      \"latest_build\": {\"integerValue\": \"$VERSION_CODE\"},"
echo "      \"latest_build_url\": {\"stringValue\": \"$DOWNLOAD_URL\"},"
echo "      \"latest_build_notes\": {\"stringValue\": \"$RELEASE_NOTES\"}"
echo "    }"
echo "  }'"
echo ""
echo "O actualizá manualmente en Firebase Console:"
echo "  https://console.firebase.google.com/project/appuntes-3b7fb/firestore/data/app_config~update"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 Release $TAG completado!"
