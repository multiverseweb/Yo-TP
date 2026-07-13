# Dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run migrations and collect static files
RUN python manage.py migrate --noinput
RUN python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["gunicorn", "project_yotp.wsgi", "--bind", "0.0.0.0:8000"]
