# ------------------------
# Stage 1: Build Frontend
# ------------------------
FROM node:18 AS frontend-build

WORKDIR /app/frontend

# Copy frontend package files first
COPY frontend/package*.json ./

# Install frontend dependencies inside container
RUN npm install

# Give execute permission to all bin scripts
RUN chmod -R +x ./node_modules/.bin

# Copy the rest of frontend source code
COPY frontend/ ./

# Build the frontend
RUN npm run build

# ------------------------
# Stage 2: Setup Backend
# ------------------------
FROM node:18

WORKDIR /app/backend

# Copy backend package files and install dependencies
COPY backend/package*.json ./
RUN npm install


# Copy backend source code
COPY backend/ ./

# Copy the built frontend from stage 1 into backend/public
COPY --from=frontend-build /app/frontend/build ./public

# Expose the port
EXPOSE 5000

# Start backend
CMD ["node", "app.js"]
