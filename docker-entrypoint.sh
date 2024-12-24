#!/bin/sh

echo "Starting entrypoint script..."
supervisord -c /etc/supervisord.conf &
echo "Supervisord started"
sleep 1
echo "Executing: $@"
exec "$@"