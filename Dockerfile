# Stage 1: Build frontend
FROM node:18 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN chmod +x /app/frontend/node_modules/.bin/react-scripts
RUN npm run build

# Stage 2: Backend
FROM node:18
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
# copy built frontend into backend
COPY --from=frontend-build /app/frontend/build /app/frontend/build
EXPOSE 5000
CMD ["node", "app.js"]