# ------------------------------
# Build frontend
# ------------------------------
FROM node:18 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN chmod +x ./node_modules/.bin/react-scripts
RUN npm run build

# ------------------------------
# Build backend
# ------------------------------
FROM node:18 AS backend
WORKDIR /app

COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install

COPY backend/ .
COPY --from=frontend-build /app/frontend/build ../frontend/build

WORKDIR /app/backend
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "app.js"]