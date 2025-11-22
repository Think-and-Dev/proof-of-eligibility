FROM node:20-alpine

WORKDIR /app

# Copiar el script
COPY src/evaluate_eligibility.js /app/evaluate_eligibility.js

# Hacer el script ejecutable
RUN chmod +x /app/evaluate_eligibility.js

# Punto de entrada: ejecuta el script con los argumentos pasados
ENTRYPOINT ["node", "/app/evaluate_eligibility.js"]

