# ==============================
# Stage 1: Build frontend
# ==============================
FROM node:18 AS frontend-build
WORKDIR /app/frontend

# Copy frontend package.json and install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source and build
COPY frontend/ ./

RUN chmod +x /app/frontend/node_modules/.bin/react-scripts

RUN npm run build

# ==============================
# Stage 2: Backend
# ==============================
FROM node:18
WORKDIR /app/backend

# Copy backend package.json and install dependencies
COPY backend/package*.json ./
RUN npm install

# Copy backend source code
COPY backend/ ./

# Copy frontend build
COPY --from=frontend-build /app/frontend/build ../frontend/build

# Expose backend port
EXPOSE 5000

# Start backend server
CMD ["node", "app.js"]
