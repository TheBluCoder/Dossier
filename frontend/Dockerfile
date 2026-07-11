FROM node:22-alpine

WORKDIR /code

RUN corepack enable

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

COPY . .

EXPOSE 5173
CMD ["pnpm", "dev"]
