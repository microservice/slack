FROM        python:3.9-alpine

COPY        app/ /app
ADD         requirements.txt /app
RUN         pip install -r /app/requirements.txt

ENTRYPOINT  ["python", "/app/main.py"]