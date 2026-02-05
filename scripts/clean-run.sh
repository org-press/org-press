#!/usr/bin/env sh
rm -rf node_modules packages/*/node_modules examples/*/node_modules docs/node_modules && \
    pnpm install && pnpm build
