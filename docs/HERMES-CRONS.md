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
| 2 | `leey-blog-pool` | 21:00 | agent | `leey-blog-08-pool.sh` |
| 3 | `leey-blog-review` | 23:00 | agent | `leey-blog-07-review.sh` |
| 4 | `leey-blog-publish` | 07:00 | agent | `leey-blog-06-publish.sh` |
| 5 | `leey-blog-health` | 07:30 | no-agent | `leey-blog-health.sh` |

Los scripts viven en `~/.hermes/scripts/` y apuntan a `scripts/blog_agents/` del repo.

## Comportamiento

- `leey-daily-listings` corre **sin LLM** y sincroniza `public/data/listings.json` desde GAMLS público.
- `leey-blog-pool` genera hasta 3 posts completos por noche para mantener una cola de al menos 10 posts listos (`data/blog/queue.json`).
- `leey-blog-review` revisa los posts en estado `ready` y los aprueba (`reviewed`) o descarta (`discarded`) según calidad.
- `leey-blog-publish` saca el post `reviewed` más antiguo de la cola y lo publica cada mañana.
- Las fases individuales (`01-research` … `05-editor`) siguen disponibles para ejecución manual, pero ya no corren por cron.

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
leey-daily-listings:  c372c999e260
leey-blog-pool:       c68012af1524
leey-blog-review:     eae5c0a562c0
leey-blog-publish:    d6ef6ad1d7b3
leey-blog-health:     2d35f9643f1d
```
