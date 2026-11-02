#!/usr/bin/env bash
# One-time reviewed Veelad production schema upgrade: existing backups required.
set -euo pipefail
umask 077
DB="u260732541_veeladprod"
USER="u260732541_veeladprod"
BACKUPS="$HOME/veelad-private-backups"
DUMP="$BACKUPS/veelad-before-upgrade.sql"
ARTWORK="$BACKUPS/veelad-artwork-before-upgrade.tar.gz"
SQL="$BACKUPS/production-migrations-017-to-022.sql"
URL="https://raw.githubusercontent.com/AhmadAlabbas/veelad.com/84ddf9ff70808d415682f3788d56911a11b20514/ops/production-migrations-017-to-022.sql"

for cmd in mysql curl tar grep; do command -v "$cmd" >/dev/null || { echo "ERROR: Required command missing: $cmd"; exit 1; }; done
test -s "$DUMP" || { echo "ERROR: Production SQL backup missing or empty"; exit 1; }
test -s "$ARTWORK" || { echo "ERROR: Production artwork backup missing or empty"; exit 1; }
grep -q '^-- Dump completed on ' "$DUMP" || { echo "ERROR: SQL backup completion marker missing"; exit 1; }
tar -tzf "$ARTWORK" >/dev/null || { echo "ERROR: Artwork archive invalid"; exit 1; }
echo "Existing backups present. Local/off-server downloads must be retained."

echo "Checking exact production migration state (database password requested)..."
current="$(mysql --batch --skip-column-names -h localhost -P 3306 -u "$USER" -p "$DB" -e "SELECT COUNT(*),SUM(CASE WHEN id>='017' THEN 1 ELSE 0 END) FROM schema_migrations;" | tr '\t' ' ')"
if [ "$current" != "15 0" ]; then
 echo "STOP: Expected 15 earlier migrations and zero migrations 017+, received: $current"
 echo "No database changes were made."
 exit 1
fi
echo "Downloading migration SQL pinned to its reviewed Git commit..."
curl --fail --location --silent --show-error "$URL" -o "$SQL"
test -s "$SQL" || { echo "ERROR: Downloaded SQL empty"; exit 1; }
chmod 600 "$SQL"
echo "Running six migrations on production (database password requested again)..."
mysql --default-character-set=utf8mb4 --show-warnings -h localhost -P 3306 -u "$USER" -p "$DB" < "$SQL"
echo "SUCCESS: SQL completed without MySQL errors. Do not delete your backups."
echo "Next step: verify the live application release from GitHub; do not manually redeploy Hostinger."
