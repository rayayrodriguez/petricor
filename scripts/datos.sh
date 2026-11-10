#!/usr/bin/env bash
# Prepara la carpeta "datos" con la rama datos del repositorio (o la crea vacía la primera vez)
# y, con "guardar", sube los cambios.
set -euo pipefail
git config user.name "Petricor"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
if [ "${1:-}" = "preparar" ]; then
  if git ls-remote --exit-code --heads origin datos >/dev/null 2>&1; then
    git fetch --depth=1 origin datos
    git worktree add -B datos datos origin/datos
  else
    git worktree add --detach datos
    cd datos
    git checkout --orphan datos
    git rm -rq --cached . || true
    find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  fi
elif [ "${1:-}" = "guardar" ]; then
  cd datos
  git add -A
  if git diff --cached --quiet; then
    echo "Sin cambios en los datos."
    exit 0
  fi
  git commit -qm "${2:-Datos actualizados}"
  for i in 1 2 3; do
    if git push -q origin datos; then exit 0; fi
    git pull -q --rebase origin datos || true
    sleep 3
  done
  exit 1
fi
