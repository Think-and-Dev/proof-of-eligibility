FROM node:20-alpine

WORKDIR /app

# Copiar package.json e instalar dependencias
COPY package.json /app/
RUN npm install

# Copiar el código fuente
COPY src/ /app/src/

# Exponer el puerto
EXPOSE 3000

# Punto de entrada: ejecuta el servidor Express
CMD ["node", "src/evaluate_eligibility.js"]

