FROM node:16.20.1
WORKDIR /app
COPY package.json ./
RUN npm install
RUN echo "npm install completed successfully!"
COPY . .
EXPOSE 80
CMD ["npm","run","start"]