TAG=$(git describe --exact-match --tags 2>/dev/null | sed 's/^v//')
if [[ -z "$TAG" ]]; then
  echo "Error: current commit is not tagged" >&2
  exit 1
fi

MANIFEST_VERSION="$(cat manifest.json | jq -r .version)"
if [[ "$TAG" != "$MANIFEST_VERSION" ]]; then
  echo "Error: git tag ($TAG) does not match manifest version ($MANIFEST_VERSION)" >&2
  exit 1
fi

VERSION="$TAG"
web-ext build -n kitsune-$VERSION.zip -o \
  -i CLAUDE.md kitsune-windows*.json *.sh *.py instance notes.md \
  -i tools package.json package-lock.json \
  -i icons/bolt.png icons/sunny.png icons/kitsune.svg \
  -i LICENSE README.md .gitignore
