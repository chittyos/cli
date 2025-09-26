FROM node:18-alpine

LABEL maintainer="ChittyCorp"
LABEL description="ChittyOS CLI - Command-line interface with AI intelligence and system integration"

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY chitty.js ./

# Make executable
RUN chmod +x chitty.js

# Create symlink for global access
RUN ln -s /app/chitty.js /usr/local/bin/chitty

# Set user for security
USER node

ENTRYPOINT ["chitty"]
CMD ["--help"]