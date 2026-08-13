#!/bin/sh
set -eu

DIR="$(dirname "$0")"
LIST="$(echo "${1:-}" | tr ',' ' ')"

if [ -z "$(echo "$LIST" | tr -d ' ')" ]; then
    echo "[integrations] none requested"
    exit 0
fi

for name in $LIST; do
    if [ ! -d "$DIR/$name" ]; then
        echo "[integrations] unknown integration: $name" >&2
        exit 1
    fi
done

packages=""
for name in $LIST; do
    if [ -f "$DIR/$name/packages" ]; then
        packages="$packages $(tr '\n' ' ' < "$DIR/$name/packages")"
    fi
done

if [ -n "$(echo "$packages" | tr -d ' ')" ]; then
    echo "[integrations] installing packages:$packages"
    apt-get update
    # shellcheck disable=SC2086
    apt-get install -y --no-install-recommends $packages
fi

for name in $LIST; do
    echo "[integrations] installing $name"

    if [ -d "$DIR/$name/rootfs" ]; then
        cp -a "$DIR/$name/rootfs/." /
    fi

    if [ -f "$DIR/$name/setup.sh" ]; then
        sh "$DIR/$name/setup.sh"
    fi
done

rm -rf /var/lib/apt/lists/*

echo "[integrations] done:$(echo " $LIST" | tr -s ' ')"
