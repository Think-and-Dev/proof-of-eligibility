FROM node:20-alpine

WORKDIR /app

# Copy package.json and install dependencies
COPY package.json /app/
RUN npm install

# Copy the source code
COPY src/ /app/src/

# Expose the port
EXPOSE 3001

# Entry point: run the Express server
CMD ["node", "src/server.js"]

