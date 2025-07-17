VERSION="$(cat manifest.json | jq -r .version)"
web-ext build -n kitsune-$VERSION.zip -o -i CLAUDE.md kitsune-windows*.json build.sh
