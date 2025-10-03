# build-run.ps1
Write-Host "-------------------------------"
Write-Host "Cleaning previous frontend & backend builds"
Write-Host "-------------------------------"

# Navigate to the script directory
Set-Location -Path $PSScriptRoot

# Delete frontend build folder and node_modules
if (Test-Path "frontend\build") { Remove-Item -Recurse -Force "frontend\build" }
if (Test-Path "frontend\node_modules") { Remove-Item -Recurse -Force "frontend\node_modules" }

# Delete backend node_modules folder
if (Test-Path "backend\node_modules") { Remove-Item -Recurse -Force "backend\node_modules" }

# Delete package-lock.json files
if (Test-Path "frontend\package-lock.json") { Remove-Item -Force "frontend\package-lock.json" }
if (Test-Path "backend\package-lock.json") { Remove-Item -Force "backend\package-lock.json" }

# Clean npm cache
npm cache clean --force

Write-Host "-------------------------------"
Write-Host "Removing Docker containers and images"
Write-Host "-------------------------------"

# Stop all running containers
docker ps -q | ForEach-Object { docker stop $_ }

# Remove all containers
docker ps -aq | ForEach-Object { docker rm $_ }

# Remove all images
docker images -q | ForEach-Object { docker rmi -f $_ }

# Prune volumes and system
docker volume prune -f
docker system prune -a --volumes -f

Write-Host "-------------------------------"
Write-Host "Installing frontend dependencies & building"
Write-Host "-------------------------------"

Set-Location -Path "frontend"
npm install
# Ensure react-toastify is installed
npm install react-toastify
npm run build

Write-Host "-------------------------------"
Write-Host "Installing backend dependencies"
Write-Host "-------------------------------"

Set-Location -Path "..\backend"
npm install

Write-Host "-------------------------------"
Write-Host "Building Docker image"
Write-Host "-------------------------------"

Set-Location -Path $PSScriptRoot
docker build -t hybrid-app-new .

Write-Host "-------------------------------"
Write-Host "Running Docker container on port 5000"
Write-Host "-------------------------------"

docker run -p 5000:5000 hybrid-app-new

Write-Host "-------------------------------"
Write-Host "Build & Run Complete"
Write-Host "-------------------------------"
Pause
