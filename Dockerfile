# -------------------------
# Stage 1: Build frontend
# -------------------------
FROM node:18 AS frontend-build

WORKDIR /app/frontend

# Copy package.json & install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source code
COPY frontend/ ./

RUN chmod +x /app/frontend/node_modules/.bin/react-scripts

# Build React frontend
RUN npm run build

# -------------------------
# Stage 2: Build backend
# -------------------------
FROM node:18

WORKDIR /app/backend

# Copy backend package.json & install dependencies
COPY backend/package*.json ./
RUN npm install

# Copy backend source code
COPY backend/ ./

# Copy frontend build from stage 1
COPY --from=frontend-build /app/frontend/build ../frontend/build

# Expose backend port
EXPOSE 5000

# Start the server
CMD ["node", "app.js"]