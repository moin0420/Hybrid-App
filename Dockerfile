# ==============================
# Stage 1: Build frontend
# ==============================
FROM node:18 AS frontend-build
WORKDIR /app/frontend

# Copy package.json and package-lock.json
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm install

# Copy frontend source code
COPY frontend/ ./

RUN chmod +x /app/frontend/node_modules/.bin/react-scripts

# Build React frontend
RUN npm run build

# ==============================
# Stage 2: Backend
# ==============================
FROM node:18
WORKDIR /app/backend

# Copy backend package.json and package-lock.json
COPY backend/package*.json ./

# Install backend dependencies
RUN npm install

# Copy backend source code
COPY backend/ ./

# Copy frontend build from previous stage
COPY --from=frontend-build /app/frontend/build ../frontend/build

# Expose backend port
EXPOSE 5000

# Start backend server
CMD ["node", "app.js"]