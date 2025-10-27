#!/bin/bash

# Exit on any error
set -e

echo "🛠 Building frontend..."
cd ../frontend
npm install
npm run build

echo "📂 Copying frontend build to backend..."
rm -rf ../backend/frontend
mkdir ../backend/frontend
cp -r build/* ../backend/frontend/

echo "🚀 Starting backend server..."
cd ../backend
node app.js
