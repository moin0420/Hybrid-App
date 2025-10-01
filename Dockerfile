# =========================
# Stage 1: Build frontend
# =========================
FROM node:18 AS frontend-build

# Set working directory for frontend
WORKDIR /app/frontend

# Copy frontend package.json & package-lock.json
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm install

# Copy frontend source
COPY frontend/ ./


RUN chmod +x ./node_modules/.bin/react-scripts

# Build the frontend
RUN npm run build

# =========================
# Stage 2: Build backend + final image
# =========================
FROM node:18

# Set working directory
WORKDIR /app

# Copy backend package.json & package-lock.json
COPY backend/package*.json ./backend/

# Install backend dependencies
RUN npm install --prefix backend

# Copy backend source code
COPY backend/ ./backend/

# Copy frontend build from previous stage into backend/public
COPY --from=frontend-build /app/frontend/build ./backend/public

# Expose port
EXPOSE 5000

# Set environment file
COPY backend/.env .env

# Set working directory to backend
WORKDIR /app/backend

# Start backend (which also serves frontend)
CMD ["node", "app.js"]