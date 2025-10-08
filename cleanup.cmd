@echo off
echo ===== Cleaning Frontend and Backend Builds =====

:: Remove frontend build
if exist frontend\build (
    rd /s /q frontend\build
    echo Frontend build removed
) else (
    echo Frontend build folder does not exist
)

:: Remove backend build/dist
if exist backend\dist (
    rd /s /q backend\dist
    echo Backend dist removed
) else (
    echo Backend dist folder does not exist
)

echo ===== Stopping and Removing Docker Containers =====

:: Stop all running containers
for /f "tokens=*" %%i in ('docker ps -aq') do docker stop %%i

:: Remove all containers
for /f "tokens=*" %%i in ('docker ps -aq') do docker rm %%i

echo ===== Removing Docker Images =====

:: Remove all images
for /f "tokens=*" %%i in ('docker images -aq') do docker rmi -f %%i

echo ===== Removing Docker Volumes =====

:: Remove all volumes
for /f "tokens=*" %%i in ('docker volume ls -q') do docker volume rm %%i

echo ===== Removing Docker Networks =====

:: Remove all networks
for /f "tokens=*" %%i in ('docker network ls -q') do docker network rm %%i

echo ===== Pruning Docker Build Cache =====
docker builder prune -af

echo ===== Cleanup Complete =====
pause