# Use Node 18
FROM node:18

# Set work directory
WORKDIR /app

# Copy backend package.json and install backend deps
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install

# Copy frontend package.json and install deps
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install

# Copy all source code
WORKDIR /app
COPY . .

# Build frontend
WORKDIR /app/frontend
RUN chmod +x ./node_modules/.bin/react-scripts
RUN npm run build

# Serve frontend from backend
WORKDIR /app/backend

EXPOSE 5000

CMD ["node", "app.js"]
