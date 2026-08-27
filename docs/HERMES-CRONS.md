# Cron jobs de Hermes para leeyrealty.com

Este documento registra los jobs programados que mantienen el blog y los listados de leeyrealty.com funcionando automáticamente.

## Instalación

```bash
cd ~/Projects/leey
bash scripts/hermes-crons-install.sh
```

El script es idempotente: borra los jobs `leey-*` existentes y los recrea.

## Jobs

| # | Nombre | Horario (ET) | Tipo | Script / Prompt |
|---|--------|--------------|------|-----------------|
| 1 | `leey-daily-listings` | 07:00 | no-agent | `leey-daily-listings-update.sh` |
| 2 | `leey-blog-research` | 21:00 | agent | `leey-blog-01-research.sh` |
| 3 | `leey-blog-topic` | 21:20 | agent | `leey-blog-02-topic.sh` |
| 4 | `leey-blog-image-search` | 21:30 | agent | `leey-blog-03a-image-search.sh` |
| 5 | `leey-blog-image-download` | 21:45 | agent | `leey-blog-03b-image-download.sh` |
| 6 | `leey-blog-writer` | 22:10 | agent | `leey-blog-04-write.sh` |
| 7 | `leey-blog-editor` | 22:40 | agent | `leey-blog-05-editor.sh` |
| 8 | `leey-blog-publish` | 07:00 | agent | `leey-blog-06-publish.sh` |
| 9 | `leey-blog-health` | 07:30 | no-agent | `leey-blog-health.sh` |

Los scripts viven en `~/.hermes/scripts/` y apuntan a `scripts/blog_agents/` del repo.

## Comportamiento

- `leey-daily-listings` corre **sin LLM** y sincroniza `public/data/listings.json` desde GAMLS público.
- Los 7 agents de blog corren en modo agente con el skill `leey-blog-pipeline`.
- Las fases nocturnas (21:00–22:40) preparan el post del día siguiente (`tomorrow`).
- `leey-blog-publish` por la mañana publica el post de hoy (`today`).

## Recuperación ante fallos

1. Ver estado de los jobs:
   ```bash
   hermes cron list
   ```

2. Ver estado del pipeline:
   ```bash
   bash scripts/blog-health.sh
   ```

3. Revisar logs de una fecha:
   ```bash
   tail -n 30 data/blog/pipeline/YYYY-MM-DD/pipeline.log.jsonl
   ```

4. Ejecutar una fase manualmente:
   ```bash
   bash scripts/blog_agents/05-editor.sh 2026-08-27
   ```

5. Correr todo el pipeline para una fecha:
   ```bash
   python3 scripts/blog_pipeline/run.py --date 2026-08-27 --stage all
   ```

6. Si el publish matutino falló, puede correrse en modo catch-up:
   ```bash
   bash scripts/blog_agents/06-publish.sh
   ```

## IDs de crons activos

Última instalación: _rellenar tras ejecutar `scripts/hermes-crons-install.sh`_.

```text
leey-daily-listings:       4ea1d5bfbec6
leey-blog-research:        c1b6500b1d74
leey-blog-topic:           f7663eb62263
leey-blog-image-search:    e4ec7b3f9c79
leey-blog-image-download:  afcd20772f5c
leey-blog-writer:          cdd2275c5385
leey-blog-editor:          39c6bce4b05c
leey-blog-publish:         34b7d7d2fa63
leey-blog-health:          dc7616f60403
```
