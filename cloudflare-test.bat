@echo off
node --env-file-if-exists=.env tools/test_cloudflare_embedding.mjs %*
