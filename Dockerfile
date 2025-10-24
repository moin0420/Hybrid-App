# --- Stage 1: Build frontend ---
FROM node:20 AS frontend-builder
WORKDIR /app/frontend

# Copy frontend package files and install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source and build
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Build backend ---
FROM node:20
WORKDIR /app/backend

# Copy backend package files & install dependencies
COPY backend/package*.json ./
RUN npm install

# Copy backend source
COPY backend/ ./

# Copy built frontend into backend
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Optional: install curl & net-tools for debugging
RUN apt-get update && apt-get install -y curl net-tools

# Expose backend port
EXPOSE 5000

# Start backend server
CMD ["node", "app.js"]
