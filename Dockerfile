# Cloud Run image — monorepo layout so agent/ and backend/ imports work (see backend/src/main.py).
FROM python:3.12-slim

WORKDIR /crisisroute

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/src backend/src
COPY backend/data backend/data
COPY agent agent

WORKDIR /crisisroute/backend

EXPOSE 8080

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080"]
