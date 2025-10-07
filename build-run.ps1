docker stop $(docker ps -aq) 2>$null
docker rm $(docker ps -aq) 2>$null
docker rmi -f $(docker images -q) 2>$null
docker system prune -a --volumes -f

Remove-Item -Recurse -Force ./frontend/build -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ./frontend/node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ./backend/node_modules -ErrorAction SilentlyContinue
Remove-Item ./frontend/package-lock.json, ./backend/package-lock.json -ErrorAction SilentlyContinue

cd frontend
npm install
npm run build
cd ../backend
npm install
cd ..