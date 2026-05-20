FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the port the application runs on
EXPOSE 4000

# Start the Node.js server
CMD ["npm", "start"]
