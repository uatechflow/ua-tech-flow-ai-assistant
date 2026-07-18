# UA TECH FLOW AI Assistant
# Project structure generator

$folders = @(
    "public",
    "routes",
    "utils",
    "tests",
    "cloudflare-demo",
    "docs"
)

$files = @(
    "server.js",
    "package.json",
    ".env.example",

    "public/index.html",
    "public/about.html",
    "public/style.css",
    "public/script.js",
    "public/news.json",

    "routes/search.js",

    "utils/aggregator.js",

    "tests/api.test.js",

    "cloudflare-demo/worker.js",
    "cloudflare-demo/wrangler.toml",

    "docs/ARCHITECTURE.md",
    "docs/API.md",
    "docs/PROJECT_DESCRIPTION.md"
)

Write-Host "Creating folders..."

foreach ($folder in $folders) {
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
    Write-Host "Created folder: $folder"
}

Write-Host ""
Write-Host "Creating files..."

foreach ($file in $files) {
    New-Item -ItemType File -Force -Path $file | Out-Null
    Write-Host "Created file: $file"
}

Write-Host ""
Write-Host "UA TECH FLOW AI Assistant structure created successfully!"