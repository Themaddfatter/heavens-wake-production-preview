FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/* && useradd -u 10001 -M -s /usr/sbin/nologin relay
WORKDIR /app
COPY requirements.txt .
RUN python -m pip install --no-cache-dir -r requirements.txt
COPY access.py identity.py destinations.py pinned_ingest.py server.py ./
USER relay
EXPOSE 8080
CMD ["python", "server.py"]
