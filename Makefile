.PHONY: bump-patch bump-minor bump-major help tag-release image image-save image-variants

# Default target
help:
	@echo "Available targets:"
	@echo "  bump-patch    - Bump patch version (x.x.X) and install dependencies"
	@echo "  bump-minor    - Bump minor version (x.X.x) and install dependencies"
	@echo "  bump-major    - Bump major version (X.x.x) and install dependencies"
	@echo "  tag-release      - Create and push git tag for current version"
	@echo ""
	@echo "  image            - Build the image locally and load it into docker"
	@echo "  image-save       - Build and pack it into $(OUT_DIR)/*.tar.gz"
	@echo "  image-variants   - List the variants defined in docker-bake.hcl"
	@echo ""
	@echo "  Overridable: VARIANT=$(VARIANT) PLATFORM=$(PLATFORM) IMAGE=$(IMAGE) TAG=$(TAG) OUT_DIR=$(OUT_DIR)"
	@echo "  e.g. make image-save PLATFORM=linux/arm64"

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


# ─── Local image builds ──────────────────────────────────────────────────────
IMAGE    ?= rwnode
TAG      ?= local
VARIANT  ?= plain
PLATFORM ?= linux/amd64
OUT_DIR  ?= build

VERSION      = $(shell node -p "require('./package.json').version")
ARCH         = $(subst linux/,,$(PLATFORM))
VARIANT_NAME = $(if $(filter plain,$(VARIANT)),,-$(VARIANT))
LOCAL_TAG    = $(IMAGE):$(TAG)$(VARIANT_NAME)
ARCHIVE      = $(OUT_DIR)/$(IMAGE)-$(VERSION)$(VARIANT_NAME)-$(ARCH).tar.gz

image:
	@echo "Building $(LOCAL_TAG) [variant: $(VARIANT), platform: $(PLATFORM)]..."
	docker buildx bake $(VARIANT) \
		--set '*.platform=$(PLATFORM)' \
		--set '*.tags=$(LOCAL_TAG)' \
		--load
	@echo "Built $(LOCAL_TAG)"

image-save: image
	@mkdir -p $(OUT_DIR)
	@echo "Saving $(LOCAL_TAG) to $(ARCHIVE)..."
	@docker save $(LOCAL_TAG) | gzip > $(ARCHIVE)
	@echo "Saved $(ARCHIVE) ($$(du -h $(ARCHIVE) | cut -f1))"

image-variants:
	@docker buildx bake --print 2>/dev/null | jq -r '.group.default.targets[]'





