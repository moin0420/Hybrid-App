# Stage 1: Build frontend
FROM node:18 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend
FROM node:18
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install          # <-- installs native modules inside Linux
COPY backend/ ./

# Copy frontend build into backend static folder
COPY --from=frontend-build /app/frontend/build ./public

EXPOSE 5000
CMD ["node", "app.js"]