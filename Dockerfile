# -------- Stage 1: Build Frontend --------
FROM node:18 AS frontend-build

# Set working directory
WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm install

# Copy frontend source code
COPY frontend/ ./

# Build frontend

RUN chmod +x ./node_modules/.bin/react-scripts
RUN npm run build

# -------- Stage 2: Setup Backend --------
FROM node:18

# Set working directory
WORKDIR /app/backend

# Copy backend package files
COPY backend/package*.json ./

# Install backend dependencies
RUN npm install

# Copy backend source code
COPY backend/ ./

# Copy frontend build to backend public folder
COPY --from=frontend-build /app/frontend/build ./public

# Expose the port
EXPOSE 5000

# Start backend server
CMD ["node", "app.js"]