VERSION="$(cat manifest.json | jq -r .version)"
web-ext sign \
  -i CLAUDE.md kitsune-windows*.json *.sh *.py instance notes.md \
  -i tools package.json package-lock.json \
  -i icons/bolt.png icons/sunny.png icons/kitsune.svg \
  -i LICENSE README.md .gitignore \
  --api-key "$AMO_JWT_ISSUER" \
  --api-secret "$AMO_JWT_SECRET" \
  --channel unlisted
