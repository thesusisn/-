FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Same-origin: nginx proxies /auth, /videos, /streams, /media to the backend,
# so the API can be called with relative paths.
ENV VITE_API_URL=""
ARG VITE_RTMP_URL
ENV VITE_RTMP_URL=${VITE_RTMP_URL}

RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
