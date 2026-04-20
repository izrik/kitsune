VERSION="$(cat manifest.json | jq -r .version)"
web-ext build -n kitsune-$VERSION.zip -o \
  -i CLAUDE.md kitsune-windows*.json *.sh *.py instance notes.md \
  -i tools logo package.json package-lock.json \
  -i icons/bolt.png icons/sunny.png icons/kitsune.svg \
  -i LICENSE README.md .gitignore
