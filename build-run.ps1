Write-Host "-------------------------------"
Write-Host "Cleaning previous frontend & backend builds"
Write-Host "-------------------------------"

Set-Location $PSScriptRoot

# Remove old build and node_modules folders
if (Test-Path "frontend/build") { Remove-Item "frontend/build" -Recurse -Force }
if (Test-Path "frontend/node_modules") { Remove-Item "frontend/node_modules" -Recurse -Force }
if (Test-Path "backend/node_modules") { Remove-Item "backend/node_modules" -Recurse -Force }

# Remove package-lock.json files
if (Test-Path "frontend/package-lock.json") { Remove-Item "frontend/package-lock.json" -Force }
if (Test-Path "backend/package-lock.json") { Remove-Item "backend/package-lock.json" -Force }

# Clean npm cache
npm cache clean --force | Out-Null

Write-Host "-------------------------------"
Write-Host "Removing Docker containers and images"
Write-Host "-------------------------------"

# Stop and remove all containers
$containers = docker ps -aq
if ($containers) {
    docker stop $containers | Out-Null
    docker rm $containers | Out-Null
}

# Remove all images
$images = docker images -q
if ($images) {
    docker rmi -f $images | Out-Null
}

# Prune volumes and system
docker volume prune -f | Out-Null
docker system prune -a --volumes -f | Out-Null

Write-Host "-------------------------------"
Write-Host "Installing frontend dependencies & building"
Write-Host "-------------------------------"

Set-Location "$PSScriptRoot\frontend"

# Ensure axios and react-toastify are installed
npm install axios react-toastify --save | Out-Null

# Install all frontend dependencies
npm install | Out-Null

# Build frontend
npm run build

Write-Host "-------------------------------"
Write-Host "Installing backend dependencies"
Write-Host "-------------------------------"

Set-Location "$PSScriptRoot\backend"
npm install | Out-Null