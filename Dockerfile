# Use Node 18 LTS
FROM node:18

# Set working directory
WORKDIR /app

# Copy root package.json and lock files if any (optional)
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies for backend
WORKDIR /app/backend
RUN npm install

# Install dependencies for frontend
WORKDIR /app/frontend
RUN npm install

# Copy all source code
WORKDIR /app
COPY . .

# Build frontend
WORKDIR /app/frontend
RUN npm run build

# Move build folder to backend so backend can serve it
RUN mv /app/frontend/build /app/backend/build

# Set working directory to backend
WORKDIR /app/backend

# Expose backend port
EXPOSE 5000

# Start backend server (it will serve frontend from /build)
CMD ["node", "app.js"]
