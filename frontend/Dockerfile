FROM nginx:alpine

COPY dist/ /usr/share/nginx/html/

RUN printf 'server {\n\
    listen 80;\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html;\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
    location /generate-excel {\n\
        proxy_pass http://poa-backend-svc:5000;\n\
    }\n\
    location /generate-csv {\n\
        proxy_pass http://poa-backend-svc:5000;\n\
    }\n\
    location /health {\n\
        proxy_pass http://poa-backend-svc:5000;\n\
    }\n\
    location /activities {\n\
        proxy_pass http://poa-backend-svc:5000;\n\
    }\n\
    location /debug-header {\n\
        proxy_pass http://poa-backend-svc:5000;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
