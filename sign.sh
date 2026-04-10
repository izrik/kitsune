VERSION="$(cat manifest.json | jq -r .version)"
web-ext sign \
  -i CLAUDE.md kitsune-windows*.json *.sh *.py instance notes.md \
  -i tools logo package.json package-lock.json \
  -i icons/bolt.png icons/read_more.png icons/sunny.png icons/kitsune.svg \
  --api-key
