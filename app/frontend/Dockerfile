# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG REACT_APP_VERSION=1.0.0
ARG REACT_APP_ENV=production
ENV REACT_APP_VERSION=$REACT_APP_VERSION
ENV REACT_APP_ENV=$REACT_APP_ENV
RUN npm run build

# ---- Runtime Stage ----
FROM nginx:1.25-alpine AS runner
LABEL maintainer="devops-team"

RUN adduser -D -u 1001 nginxuser

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R nginxuser:nginxuser /usr/share/nginx/html /var/cache/nginx /var/log/nginx \
    && chmod -R 755 /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
