FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ./app ./app

EXPOSE 8001

CMD ["sh", "-c", "gunicorn app.main:app \
-k uvicorn.workers.UvicornWorker \
-w ${APP_WORKERS:-1} \
-b ${APP_HOST:-0.0.0.0}:${APP_PORT:-8001} \
--timeout ${APP_TIMEOUT:-120} \
--graceful-timeout ${APP_GRACEFUL_TIMEOUT:-30} \
--keep-alive ${APP_KEEP_ALIVE:-5} \
--access-logfile - \
--error-logfile -"]