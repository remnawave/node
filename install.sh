#!/usr/bin/env bash

# Download sing-box latest

RELEASE_TAG="latest"
UPSTREAM_REPO="SagerNet"

if [[ "$1" ]]; then
    RELEASE_TAG="$1"
fi

if [[ "$2" ]]; then
    UPSTREAM_REPO="$2"
fi

check_if_running_as_root() {
    # If you want to run as another user, please modify $EUID to be owned by this user
    if [[ "$EUID" -ne '0' ]]; then
        echo "error: You must run this script as root!"
        exit 1
    fi
}

identify_the_operating_system_and_architecture() {
    if [[ "$(uname)" == 'Linux' ]]; then
        case "$(uname -m)" in
            'i386' | 'i686')
                ARCH='386'
            ;;
            'amd64' | 'x86_64')
                ARCH='amd64'
            ;;
            'armv5tel')
                ARCH='armv5'
            ;;
            'armv6l')
                ARCH='armv6'
            ;;
            'armv7' | 'armv7l')
                ARCH='armv7'
            ;;
            'armv8' | 'aarch64')
                ARCH='arm64'
            ;;
            'mips')
                ARCH='mips'
            ;;
            'mipsle')
                ARCH='mipsle'
            ;;
            'mips64')
                ARCH='mips64'
                lscpu | grep -q "Little Endian" && ARCH='mips64le'
            ;;
            'mips64le')
                ARCH='mips64le'
            ;;
            'riscv64')
                ARCH='riscv64'
            ;;
            's390x')
                ARCH='s390x'
            ;;
            *)
                echo "error: The architecture is not supported."
                exit 1
            ;;
        esac
    else
        echo "error: This operating system is not supported."
        exit 1
    fi
}

download_singbox() {
    if [[ "$RELEASE_TAG" == "latest" ]]; then
        DOWNLOAD_LINK="https://github.com/$UPSTREAM_REPO/sing-box/releases/latest/download/sing-box-$VERSION-linux-$ARCH.tar.gz"
        # Get the latest version tag
        VERSION=$(curl -s https://api.github.com/repos/$UPSTREAM_REPO/sing-box/releases/latest | grep '"tag_name":' | sed -E 's/.*"v([^"]+)".*/\1/')
        if [[ -z "$VERSION" ]]; then
            echo "error: Failed to get latest version"
            exit 1
        fi
        echo "Latest version: $VERSION"
        DOWNLOAD_LINK="https://github.com/$UPSTREAM_REPO/sing-box/releases/latest/download/sing-box-$VERSION-linux-$ARCH.tar.gz"
    else
        VERSION="${RELEASE_TAG#v}"
        DOWNLOAD_LINK="https://github.com/$UPSTREAM_REPO/sing-box/releases/download/$RELEASE_TAG/sing-box-$VERSION-linux-$ARCH.tar.gz"
    fi
    
    echo "Downloading sing-box archive: $DOWNLOAD_LINK"
    if ! curl -RL -H 'Cache-Control: no-cache' -o "$TAR_FILE" "$DOWNLOAD_LINK"; then
        echo 'error: Download failed! Please check your network or try again.'
        return 1
    fi
}

extract_singbox() {
    if ! tar -xzf "$TAR_FILE" -C "$TMP_DIRECTORY"; then
        echo 'error: sing-box decompression failed.'
        "rm" -rf "$TMP_DIRECTORY"
        echo "removed: $TMP_DIRECTORY"
        exit 1
    fi
    echo "Extracted sing-box archive to $TMP_DIRECTORY"
}

place_singbox() {
    install -m 755 "${TMP_DIRECTORY}/sing-box-${VERSION}-linux-${ARCH}/sing-box" "/usr/local/bin/sing-box"
    echo "sing-box binary installed to /usr/local/bin/sing-box"
}

check_if_running_as_root
identify_the_operating_system_and_architecture

TMP_DIRECTORY="$(mktemp -d)"
TAR_FILE="${TMP_DIRECTORY}/sing-box-linux-$ARCH.tar.gz"

download_singbox
extract_singbox
place_singbox

"rm" -rf "$TMP_DIRECTORY"
