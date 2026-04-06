FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001

CMD ["sh", "-c", "uvicorn main:app \
--host ${APP_HOST:-0.0.0.0} \
--port ${APP_PORT:-8001} \
--workers ${APP_WORKERS:-1} \
--timeout-keep-alive ${APP_KEEP_ALIVE:-5} \
--log-level info"]