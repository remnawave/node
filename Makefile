.PHONY: bump-patch bump-minor bump-major help tag-release

# Default target
help:
	@echo "Available targets:"
	@echo "  bump-patch    - Bump patch version (x.x.X) and install dependencies"
	@echo "  bump-minor    - Bump minor version (x.X.x) and install dependencies"
	@echo "  bump-major    - Bump major version (X.x.x) and install dependencies"
	@echo "  tag-release      - Create and push git tag for current version"

# Bump patch version (0.0.1 -> 0.0.2)
bump-patch:
	@echo "Bumping patch version..."
	npm version patch --no-git-tag-version
	@echo "New version: $$(node -p "require('./package.json').version")"
	npm install

# Bump minor version (0.1.0 -> 0.2.0)
bump-minor:
	@echo "Bumping minor version..."
	npm version minor --no-git-tag-version
	@echo "New version: $$(node -p "require('./package.json').version")"
	npm install
# Bump major version (1.0.0 -> 2.0.0)
bump-major:
	@echo "Bumping major version..."
	npm version major --no-git-tag-version
	@echo "New version: $$(node -p "require('./package.json').version")"
	npm install

# Create and push git tag for current version
tag-release:
	@VERSION=$$(node -p "require('./package.json').version") && \
	echo "Creating signed tag for version $$VERSION..." && \
	git tag -s "$$VERSION" -m "Release $$VERSION" && \
	git push origin --follow-tags && \
	echo "Signed tag $$VERSION created and pushed"





