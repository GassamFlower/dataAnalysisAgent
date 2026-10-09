#!/bin/bash
# PostgreSQL 自动备份脚本
# 用法: bash scripts/db-backup.sh
# Crontab: 0 3 * * * /opt/dataAnalysisAgent/scripts/db-backup.sh >> /var/log/daa-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="/opt/backups/postgres"
RETENTION_DAYS=7
CONTAINER_NAME="daa-db"
DB_NAME="data_analysis_agent"
DB_USER="postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sqlc"

mkdir -p "$BACKUP_DIR"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "[$(date)] ERROR: Container $CONTAINER_NAME is not running"
  exit 1
fi

echo "[$(date)] Starting backup..."

docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -Fc --compress=9 \
  -d "$DB_NAME" > "$BACKUP_FILE"

FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup completed: backup_$TIMESTAMP.sqlc ($FILE_SIZE)"

DELETED=$(find "$BACKUP_DIR" -name "backup_*.sqlc" -mtime +$RETENTION_DAYS -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "[$(date)] Cleaned up $DELETED backup(s) older than ${RETENTION_DAYS} days"
fi

TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "backup_*.sqlc" | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo "[$(date)] Total: $TOTAL_BACKUPS backups, $TOTAL_SIZE"
