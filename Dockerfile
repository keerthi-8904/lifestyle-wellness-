FROM node:22-alpine AS frontend-build
WORKDIR /client
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements-postgres.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt -r backend/requirements-postgres.txt
COPY backend ./backend
COPY --from=frontend-build /client/dist ./dist
ENV FRONTEND_DIST=/app/dist
EXPOSE 10000
CMD ["sh", "-c", "uvicorn main:app --app-dir /app/backend --host 0.0.0.0 --port ${PORT:-10000}"]
